import importlib.util
import json
import base64
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('worker', Path(__file__).parents[1] / 'plugin/worker.py')
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
spec_hunyuan = importlib.util.spec_from_file_location('hunyuan', Path(__file__).parents[1] / 'plugin/hunyuan.py')
hunyuan = importlib.util.module_from_spec(spec_hunyuan)
spec_hunyuan.loader.exec_module(hunyuan)

class WorkerTests(unittest.TestCase):
    def test_metal_and_vulkan_commands_use_fixed_local_backends(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            request={'model':'qwen-image-2.1-turbo','prompt':'stone','seed':42,'size':512,'purpose':'texture'}
            for backend,filename in [('metal','sd-cli'),('vulkan','sd-cli.exe'),('cuda','sd-cli.exe')]:
                (root/'runtime.json').write_text(json.dumps({'sd_cli':'sd-cpp/'+filename,'backend':backend}))
                command=worker.image_command(root,request,root/'image.png')
                self.assertEqual(Path(command[0]).name,filename)
                self.assertIn('--mmap',command)
                self.assertIn('--params-backend',command)
            model=root/'models/stable-audio-3-small-sfx/model.gguf'
            model.parent.mkdir(parents=True);model.write_bytes(b'GGUFfixture')
            audio={'model':'stable-audio-3-small-sfx','prompt':'click','seed':42,'duration':1}
            for backend,filename in [('metal','audiocpp_cli'),('vulkan','audiocpp_cli.exe'),('cuda','audiocpp_cli.exe')]:
                (root/'audio-backend.json').write_text(json.dumps({'backend':backend}))
                command=worker.audio_command(root,audio,root/'audio.wav')
                self.assertEqual(command[command.index('--backend')+1],backend)
                self.assertEqual(Path(command[0]).name,filename)
            (root/'audio-backend.json').write_text(json.dumps({'backend':'arbitrary'}))
            with self.assertRaises(ValueError):worker.audio_command(root,audio,root/'audio.wav')
            self.assertEqual(worker.runtime_root(root/'qwen.app/Contents/bin/python3.11'),root/'qwen.app/Contents')

    def test_native_rgba_prompt_preserves_agent_description_and_background_exceptions(self):
        request = {'prompt': 'A small hand painted golden coin', 'purpose': 'icon'}
        prompt = worker.image_prompt(request)
        self.assertIn(request['prompt'], prompt)
        self.assertTrue(prompt.startswith('This is an RGBA'))
        self.assertTrue(prompt.endswith('background is transparent.'))
        self.assertIn('game icon', prompt)
        self.assertIn('three-quarter', worker.image_prompt({**request, 'purpose':'model-reference'}))
        for purpose in ['scene', 'texture']:
            self.assertEqual(worker.image_prompt({**request, 'purpose':purpose}), request['prompt'])
        with self.assertRaises(ValueError):
            worker.image_prompt({**request, 'purpose':'anything'})

    def test_png_alpha_validation_is_read_only_and_rejects_fake_transparency(self):
        import tempfile
        from PIL import Image
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / 'image.png'
            image = Image.new('RGBA', (100,100), (255,255,255,0))
            image.paste((20,40,200,255),(20,30,80,70))
            image.save(file)
            before = file.read_bytes()
            result = worker.require_transparent_png(file,100)
            self.assertEqual(result['transparentFraction'],0.76)
            self.assertEqual(result['foregroundFraction'],0.24)
            self.assertEqual(file.read_bytes(),before)
            for invalid in [Image.new('RGBA',(100,100),(220,220,220,254)), Image.new('RGBA',(100,100),0), Image.new('RGB',(100,100),'white')]:
                invalid.save(file)
                with self.assertRaises(worker.TransparencyError):
                    worker.require_transparent_png(file,100)
            file.write_bytes(before[:-30])
            with self.assertRaises(worker.TransparencyError):
                worker.require_transparent_png(file,100)
            file.write_bytes(before[:-12])
            with self.assertRaises(worker.TransparencyError):
                worker.require_transparent_png(file,100)

    def test_native_alpha_failure_retries_once_without_editing_generated_pixels(self):
        import tempfile, os, io
        from contextlib import redirect_stdout
        from types import SimpleNamespace
        from unittest.mock import patch
        from PIL import Image
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            output=root/'image.png'
            (root/'runtime.json').write_text(json.dumps({'sd_cli':'sd-cpp/sd-cli.exe'}))
            request={'model':'qwen-image-2.1-turbo','prompt':'A golden coin','seed':42,'size':512,'purpose':'icon'}
            expected=Image.new('RGBA',(512,512),0)
            expected.paste((200,160,20,255),(128,128,384,384))
            generated=[]
            def infer(command,**kwargs):
                image=Image.new('RGBA',(512,512),(220,220,220,254)) if not generated else expected
                image.save(output);generated.append(output.read_bytes())
                return SimpleNamespace(returncode=0)
            stream=io.StringIO()
            with patch.object(worker.sys,'executable',str(root/'python.exe')), patch.dict(os.environ,{'TMPDIR':folder,'TEMP':folder}), patch.object(worker.subprocess,'run',side_effect=infer) as run, redirect_stdout(stream):
                worker.run('image',output,base64.b64encode(json.dumps(request).encode()).decode())
            self.assertEqual(run.call_count,2)
            self.assertEqual(output.read_bytes(),generated[1])
            self.assertEqual((root/'rejected-opaque-image.png').read_bytes(),generated[0])
            receipt=json.loads(stream.getvalue().split('GENEX_LOCAL_RESULT ')[-1])
            self.assertEqual(receipt['seed'],43)
            self.assertEqual(receipt['attempts'],2)
            self.assertTrue(receipt['alpha']['verified'])
            def opaque(command,**kwargs):
                Image.new('RGBA',(512,512),(220,220,220,254)).save(output)
                return SimpleNamespace(returncode=0)
            with patch.object(worker.sys,'executable',str(root/'python.exe')), patch.dict(os.environ,{'TMPDIR':folder,'TEMP':folder}), patch.object(worker.subprocess,'run',side_effect=opaque) as run, redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError,'NATIVE_RGBA_REQUIRED'):
                    worker.run('image',output,base64.b64encode(json.dumps(request).encode()).decode())
                self.assertEqual(run.call_count,2,'Repeated alpha failures must stop, not spin or accept an opaque image')

    def test_nearly_opaque_qwen_alpha_is_not_a_foreground_mask(self):
        from PIL import Image
        # Qwen's PNG can have 239..255 alpha without a single background hole.
        image = Image.new('RGBA', (100, 100), (220, 220, 220, 255))
        image.putpixel((1, 1), (20, 40, 200, 239))
        self.assertFalse(hunyuan.has_foreground_mask(image))
        self.assertFalse(hunyuan.has_foreground_mask(Image.new('RGB', (100, 100))))

    def test_real_transparent_cutout_is_preserved_without_mask_inference(self):
        from PIL import Image
        from unittest.mock import patch
        image = Image.new('RGBA', (100, 100), (255, 255, 255, 0))
        image.paste((20, 40, 200, 255), (20, 30, 80, 70))
        self.assertTrue(hunyuan.has_foreground_mask(image))
        with patch.object(hunyuan, 'remove_background', side_effect=AssertionError('Already a cutout')):
            result = hunyuan.prepare_reference(Path('unused'), image)
        self.assertEqual(result.tobytes(), image.tobytes())

    def test_noisy_alpha_runs_removal_and_empty_masks_fail_before_gpu_load(self):
        from PIL import Image
        from unittest.mock import patch
        image = Image.new('RGBA', (100, 100), (220, 220, 220, 254))
        clean = Image.new('RGBA', image.size, (255, 255, 255, 0))
        clean.paste((20, 40, 200, 255), (20, 30, 80, 70))
        with patch.object(hunyuan, 'remove_background', return_value=clean) as remove:
            self.assertEqual(hunyuan.prepare_reference(Path('unused'), image).tobytes(), clean.tobytes())
            remove.assert_called_once()
        with self.assertRaisesRegex(RuntimeError, 'foreground'):
            hunyuan.prepare_reference(Path('unused'), Image.new('RGBA', image.size, 0))
        with patch.object(hunyuan, 'remove_background', return_value=Image.new('RGBA', image.size, (255,255,255,255))):
            with self.assertRaisesRegex(RuntimeError, '[Bb]ackground'):
                hunyuan.prepare_reference(Path('unused'), image)

    def test_hunyuan_never_accepts_a_model_path_or_old_trellis_request(self):
        root = Path('D:/owned-runtime')
        command = hunyuan.command(root, {'model': 'hunyuan3d-2-turbo', 'seed': 42}, 'out.glb', 'in.png')
        self.assertEqual(command[0], str(root / 'python.exe'))
        self.assertEqual(command[-5:], ['full', 'in.png', 'out.glb', '42', 'balanced'])
        for request in [{'model': 'trellis-2-low-vram', 'seed': 42},
                        {'model': 'hunyuan3d-2-turbo', 'seed': 42, 'program': 'cmd.exe'},
                        {'model': 'hunyuan3d-2-turbo', 'seed': True}]:
            with self.assertRaises(ValueError):
                hunyuan.command(root, request, 'out.glb', 'in.png')

    def test_fixed_quality_profiles_bound_memory_and_preserve_detail(self):
        profile=hunyuan.quality_profile('high')
        self.assertEqual(profile['octree'],512)
        self.assertGreater(profile['faces'],hunyuan.quality_profile('balanced')['faces'])
        self.assertEqual(profile['view'],512)
        for quality in ['ultra',{'octree':8192},False]:
            with self.assertRaises(ValueError):
                hunyuan.command(Path('D:/owned-runtime'),{'model':'hunyuan3d-2-turbo','seed':42,'quality':quality},'out.glb','in.png')
        self.assertEqual(hunyuan.command(Path('D:/owned-runtime'),{'model':'hunyuan3d-2-turbo','seed':42,'quality':'balanced'},'out.glb','in.png')[-1],'balanced')

    def test_uv_splitting_preserves_original_surface_normals_and_other_data(self):
        import numpy as np
        import trimesh
        source=trimesh.creation.icosphere(subdivisions=1)
        # The same geometry split at every corner models UV seams. A viewer
        # recomputing normals here would shade each triangle independently.
        original_indices=source.faces.reshape(-1)
        result=trimesh.Trimesh(vertices=source.vertices[original_indices],faces=np.arange(len(original_indices)).reshape(-1,3),process=False)
        before_vertices=result.vertices.copy();before_faces=result.faces.copy()
        hunyuan.preserve_surface_normals(source,result)
        np.testing.assert_allclose(result.vertex_normals,source.vertex_normals[original_indices])
        np.testing.assert_array_equal(result.vertices,before_vertices)
        np.testing.assert_array_equal(result.faces,before_faces)
        result.vertices=result.vertices+10
        with self.assertRaisesRegex(RuntimeError,'changed the source surface'):
            hunyuan.preserve_surface_normals(source,result)

    def test_paint_failure_is_not_reported_as_a_successful_shape(self):
        import tempfile
        from types import SimpleNamespace
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / 'Hunyuan3D-2/hy3dgen/shapegen/pipelines.py'
            source.parent.mkdir(parents=True)
            source.write_text('# owned test fixture')
            with patch.object(hunyuan.sys, 'executable', str(root / 'python.exe')), \
                 patch.object(hunyuan.sys, 'argv', ['hunyuan.py', 'full', 'in.png', 'out.glb', '42']), \
                 patch.dict(hunyuan.os.environ, {'TEMP': folder, 'TMPDIR': folder}), \
                 patch.object(hunyuan.subprocess, 'run', side_effect=[SimpleNamespace(returncode=0), SimpleNamespace(returncode=1)]) as run:
                with self.assertRaisesRegex(RuntimeError, 'paint failed'):
                    hunyuan.main()
                self.assertEqual([call.args[0][2] for call in run.call_args_list], ['shape', 'paint'])
    def test_only_known_auxiliary_files_are_removed(self):
        import tempfile
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            for file in ['model.glb', 'model.ply', 'model_base.png', 'keep.png']:
                (root / file).write_bytes(b'data')
            worker.cleanup_model_auxiliary(root / 'model.glb')
            self.assertEqual(sorted(file.name for file in root.iterdir()), ['keep.png', 'model.glb'])
    def test_request_validation(self):
        encode = lambda value: base64.b64encode(json.dumps(value).encode()).decode()
        for value in [[], {'seed': -1}, {'seed': 1, 'prompt': '\0'}]:
            with self.assertRaises(ValueError): worker.request_value(encode(value))
    def test_no_shell_or_user_chosen_executable(self):
        import tempfile
        with tempfile.TemporaryDirectory() as root:
            root = Path(root)
            (root / 'runtime.json').write_text(json.dumps({'sd_cli': '../cmd.exe'}))
            with self.assertRaises(ValueError): worker.image_command(root, {'model':'qwen-image-2.1-turbo','prompt':'wood','seed':42,'size':512}, root/'out.png')

if __name__ == '__main__': unittest.main()

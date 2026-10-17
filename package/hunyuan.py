"""Headless Hunyuan3D 2.0 adapter. Shape and paint exit between phases.

Only pinned local code and weights are used; no Gradio server or downloads.
"""
import json
import os
from pathlib import Path
import sys

MODEL = "hunyuan3d-2-turbo"
PROFILES = {
    "balanced": {"octree": 384, "faces": 50000, "view": 512, "render": 1024, "texture": 1024},
    "high": {"octree": 512, "faces": 200000, "view": 512, "render": 2048, "texture": 2048},
}


def quality_profile(quality):
    if not isinstance(quality, str) or quality not in PROFILES:
        raise ValueError("Choose a fixed Hunyuan quality profile: balanced or high")
    return dict(PROFILES[quality])


def preserve_surface_normals(source, textured):
    """UV splitting must not turn a smooth source surface into isolated flat triangles."""
    import numpy as np
    from scipy.spatial import cKDTree
    vertices = np.asarray(source.vertices)
    normals = np.array(source.vertex_normals, copy=True)
    distances, indices = cKDTree(vertices).query(np.asarray(textured.vertices), workers=4)
    tolerance = max(float(np.linalg.norm(source.extents)) * 1e-6, 1e-8)
    if not np.all(np.isfinite(distances)) or np.any(distances > tolerance):
        raise RuntimeError("Texturing changed the source surface; cannot safely transfer its normals")
    textured.vertex_normals = normals[indices]
    return textured


def command(root, request, output, image, phase="shape", mesh=None):
    if request.get("model") != MODEL or set(request) not in ({"model", "seed"}, {"model", "seed", "quality"}) or not image:
        raise ValueError("Unsupported Hunyuan3D request")
    if type(request["seed"]) is not int or not 0 <= request["seed"] <= 2147483647:
        raise ValueError("Invalid 3D seed")
    quality = request.get("quality", "balanced")
    quality_profile(quality)
    if phase not in {"shape", "paint"} or (phase == "paint") != bool(mesh):
        raise ValueError("Expected one fixed shape or paint job")
    args = [str(root / "python.exe"), str(Path(__file__).resolve()), phase,
            str(mesh if phase == "paint" else image), str(output), str(request["seed"]), quality]
    return args + ([str(image)] if phase == "paint" else [])


def setup(root, scratch):
    source = root / "Hunyuan3D-2"
    if not (source / "hy3dgen/shapegen/pipelines.py").is_file():
        raise RuntimeError("The pinned Hunyuan3D runtime is incomplete; run its setup again.")
    sys.path.insert(0, str(source))
    os.environ.update({"HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "HF_HOME": str(scratch / "hf"),
                       "HF_MODULES_CACHE": str(scratch / "hf-modules"), "HY3DGEN_MODELS": str(root / "models"),
                       "U2NET_HOME": str(root / "models/rembg"), "PYTHONDONTWRITEBYTECODE": "1"})
    return source


def remove_background(root, image):
    """The rembg U2Net normalization/mask, without importing optional matting/JIT.

    Based on rembg's MIT-licensed U2netSession (Daniel Gatis, 2020).
    The original license is retained in LICENSE.rembg.
    """
    import numpy as np
    import onnxruntime as ort
    from PIL import Image
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    session = ort.InferenceSession(str(root / "models/rembg/u2net.onnx"), sess_options=options, providers=["CPUExecutionProvider"])
    pixels = np.asarray(image.convert("RGB").resize((320, 320), Image.Resampling.LANCZOS))
    pixels = pixels / max(float(pixels.max()), 1e-6)
    pixels = (pixels - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    tensor = pixels.transpose(2, 0, 1)[None].astype(np.float32)
    mask = session.run(None, {session.get_inputs()[0].name: tensor})[0][0, 0]
    span = float(mask.max() - mask.min())
    if span <= 1e-8:
        raise RuntimeError("The object reference has no identifiable foreground")
    mask = ((mask - mask.min()) / span).clip(0, 1)
    alpha = Image.fromarray((mask * 255).astype("uint8")).resize(image.size, Image.Resampling.LANCZOS)
    # Keep straight RGB: the Hunyuan processor composites it onto white itself.
    # Compositing here as well would darken antialiased edges twice.
    result = image.convert("RGBA")
    result.putalpha(alpha)
    return result


def has_foreground_mask(image):
    """An alpha channel alone is not evidence of background removal.

    Qwen's almost-opaque PNGs contain alpha values such as 239..255. Reusing
    that channel makes Hunyuan reconstruct the entire rectangular backdrop.
    Require actual transparent background and a nontrivial visible foreground.
    """
    if image.mode != "RGBA":
        return False
    histogram = image.getchannel("A").histogram()
    minimum = max(1, image.width * image.height * 0.01)
    return sum(histogram[:17]) >= minimum and sum(histogram[128:]) >= minimum


def prepare_reference(root, image):
    from PIL import ImageOps
    image = ImageOps.exif_transpose(image).convert("RGBA")
    if image.getextrema()[3][1] < 128:
        raise RuntimeError("The reference has no visible foreground")
    if not has_foreground_mask(image):
        # CPU-only segmentation; no additional model remains on the GPU.
        image = remove_background(root, image)
    # Tiny resampling tails must not expand the processor's nonzero-alpha crop.
    alpha = image.getchannel("A").point(lambda value: 0 if value < 8 else 255 if value > 247 else value)
    image.putalpha(alpha)
    if not has_foreground_mask(image):
        raise RuntimeError("Background removal did not produce an isolated foreground; use a clearer object reference")
    return image


def shape(root, scratch, image_path, output, seed, quality="balanced"):
    profile = quality_profile(quality)
    print(json.dumps({"quality": quality, "profile": profile}), flush=True)
    print("Hunyuan3D: preparing an isolated object reference", flush=True)
    from PIL import Image
    with Image.open(image_path) as source:
        image = prepare_reference(root, source)
    # The next job has a fresh scratch directory. Retain the exact prepared image
    # as a declared output alongside the immutable untextured mesh.
    image.save(Path(output).with_name("reference.png"))
    print(json.dumps({"referenceAlpha": image.getextrema()[3], "foregroundBounds": image.getbbox()}), flush=True)
    print("Hunyuan3D: loading the shape adapter", flush=True)
    import torch
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FaceReducer
    from hy3dgen.shapegen.pipelines import export_to_trimesh
    from mmgp import offload

    torch.set_num_threads(6)
    pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        str(root / "models/tencent/Hunyuan3D-2"), subfolder="hunyuan3d-dit-v2-0-turbo", device="cpu", use_safetensors=True)
    pipe.enable_flashvdm(mc_algo="mc", replace_vae=False)
    # Match the portable pack's mmgp integration while avoiding pinned RAM on a 32 GB PC.
    pipe.__class__._execution_device = property(lambda self: "cuda")
    offload.profile(offload.extract_models("shape", pipe), profile_no=5, budgets={"*": 3200}, verboseLevel=1)
    meshes = pipe(image=image, num_inference_steps=8, guidance_scale=5.0,
                  generator=torch.Generator().manual_seed(seed), octree_resolution=profile["octree"],
                  num_chunks=6000, output_type="mesh", mc_algo="mc")
    mesh = export_to_trimesh(meshes)[0]
    original_faces = len(mesh.faces)
    if len(mesh.faces) > profile["faces"]:
        # Optimize a generated intermediate; retained user assets are never touched.
        mesh = FaceReducer()(mesh, max_facenum=profile["faces"])
    if not len(mesh.faces):
        raise RuntimeError("Hunyuan3D produced an empty shape")
    mesh.export(output)
    print(f"Hunyuan3D shape saved: {len(mesh.vertices)} vertices, {len(mesh.faces)} triangles (before simplification: {original_faces})", flush=True)


def paint(root, scratch, shape_path, output, seed, quality, image_path):
    profile = quality_profile(quality)
    print("Hunyuan3D: loading the paint adapter; shape process has exited", flush=True)
    import torch
    import trimesh
    from PIL import Image
    from hy3dgen.texgen import Hunyuan3DPaintPipeline
    from mmgp import offload

    torch.set_num_threads(6)
    torch.manual_seed(seed)
    pipe = Hunyuan3DPaintPipeline.from_pretrained(str(root / "models/tencent/Hunyuan3D-2"), subfolder="hunyuan3d-paint-v2-0-turbo")
    pipe.models["multiview_model"].pipeline.vae.use_slicing = True
    offload.profile(offload.extract_models("paint", pipe), profile_no=5, budgets={"*": 3200}, verboseLevel=1)
    # Keep the trained 512px diffusion views: 768px produced visible texture artifacts
    # in the paired test. The atlas preserves baking detail; it is not a neural upscaler.
    pipe.models["multiview_model"].view_size = profile["view"]
    pipe.config.render_size = profile["render"]
    pipe.config.texture_size = profile["texture"]
    pipe.render.set_default_render_resolution(profile["render"])
    pipe.render.set_default_texture_resolution(profile["texture"])
    mesh = trimesh.load(shape_path, force="mesh")
    surface = mesh.copy()
    with Image.open(image_path) as reference:
        result = pipe(mesh, reference.convert("RGBA"))
    preserve_surface_normals(surface, result).export(output, include_normals=True)
    if not getattr(result.visual, "material", None):
        raise RuntimeError("Texture generation returned no material")
    print(f"Hunyuan3D textured GLB saved: {len(result.faces)} triangles", flush=True)


def main():
    if len(sys.argv) not in (6, 7) or sys.argv[1] not in {"shape", "paint"}:
        raise ValueError("Expected a fixed generation phase, input, output and seed")
    phase, image, output, seed = sys.argv[1:5]
    quality = sys.argv[5]
    if len(sys.argv) != (7 if phase == "paint" else 6):
        raise ValueError("Paint requires its retained reference image; shape has only one input")
    quality_profile(quality)
    if not seed.isdecimal() or not 0 <= int(seed) <= 2147483647:
        raise ValueError("Invalid seed")
    root = Path(sys.executable).resolve().parent
    scratch = Path(os.environ.get("TMPDIR", os.environ.get("TEMP", str(Path(output).parent)))) / "hunyuan"
    scratch.mkdir(exist_ok=True)
    setup(root, scratch)
    if phase == "shape":
        shape(root, scratch, image, output, int(seed), quality)
    else:
        paint(root, scratch, image, output, int(seed), quality, sys.argv[6])


if __name__ == "__main__":
    main()

# Runtime provenance and remaining setup work

No model weights are committed here. Pinned download metadata is in `scripts/qwen-assets.json`, `audio-assets.json`, `hunyuan-assets.json`, `hunyuan-weights.json`, `hunyuan-turbo-checkpoint.json` and `hunyuan-cuda.json`. These are provenance records, not an automatic Hunyuan installer.

## Qwen and Stable Audio

The declared user-confirmed Install action handles these routes. It installs Python 3.11.9 embedded on Windows or Python 3.11.17 standalone on Apple Silicon, pinned native libraries and public GGUF weights. `scripts/platform-assets.json` pins platform archives by release URL, byte count and SHA-256. Read the action's review before approving. It never logs into Hugging Face or asks for tokens. Inspect original model licenses for intended use; public download availability is not a blanket commercial grant. The [README setup table](../README.md#setup-boundaries) distinguishes cached downloads from working files, including the two on-disk copies of large weights.

`plugin/native/win32-x64/audiocpp_cli.exe` is a local Stable Audio-only build from audio.cpp `cf124a67cc55d8f65a9a15eec69edbff0fb212c8`. `plugin/audio-runtime.json` records the executable size/hash and original upstream hash. `plugin/lpac_path.h` handles ancestor-normalization failures on already-granted Windows paths without changing permission grants. `scripts/patch-audio-source.py` applies that source change to an explicit checkout at the pinned revision and refuses another revision. The full Apache-2.0 notice and modification statement are in `plugin/native/win32-x64/NOTICES.txt`.

The measured build used Visual Studio 2022 x64, shared libraries, `AUDIOCPP_DEPLOYMENT_BUILD=ON`, `AUDIOCPP_MODEL_SET=custom`, `AUDIOCPP_MODELS=stable_audio`, `ENGINE_ENABLE_CUDA=OFF`, `AUDIOCPP_BUILD_NATIVE_MODEL_MANAGER=OFF`, `AUDIOCPP_BUILD_SERVER_FRONTENDS=OFF`, `ENGINE_BUILD_TESTS=OFF` and `AUDIOCPP_STATIC_ESPEAK=OFF`. Runtime CUDA/ggml DLLs come from the pinned unmodified v0.9.1 release. This is a source rebuild recipe, not a guarantee of byte-identical PE output across compiler versions. Verify the shipped binary against its metadata before use; do not silently substitute a rebuilt binary while retaining the old digest.

## Hunyuan

The tested external runtime uses Hunyuan3D-2 Windows Portable `v4-cu129`, Python 3.12, CUDA texture extensions and the pinned Turbo shape/paint checkpoints. `plugin/hunyuan.py` documents the exact expected directory layout, local loader calls, FP16 paint expectations, mmgp offload budget and process phases. Catalog readiness is not a complete runtime health test: it checks declared files, not that every extension can execute on a fresh machine.

The tested machine needed compiled `custom_rasterizer`/`mesh_processor` texture extensions and a verified FP16 paint derivative with a meta-initialized loader. Their clean-machine provisioning is not yet an automatic supported workflow. Do not assume a stock portable extraction alone meets these requirements. A fresh-user Hunyuan installer, reproducible loader preparation and independent clean-machine end-to-end verification are release blockers, explicitly retained in the draft PR.

macOS image/audio profiles use the upstream Metal releases. New Windows setups use Vulkan, including AMD; existing CUDA installations retain their matching binaries. Both routes still need real hardware inference and released-host acceptance. The CUDA CLI is dynamically linked and cannot be substituted into the upstream statically linked Vulkan archive: a no-weight startup test exposed the missing GGML DLL dependency. A separate Vulkan compatibility build is required for Windows sandbox path normalization; the unmodified release reproduced `weakly_canonical: Access is denied` on a tiny malformed-GGUF file probe.

Linux, Intel Mac, Windows ARM, a user-selectable arbitrary runtime location and automatic model-adapter discovery are not implemented. Cache discovery is only an inventory of possible candidates; assignment is limited to the reviewed fixed routes. Hunyuan remains a separate Windows/NVIDIA setup, independent of Metal/Vulkan image/audio profiles.

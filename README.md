# Local Models for Genex

Generate local game images, textures, sound and music with platform-specific Metal or Vulkan runtimes. Windows/NVIDIA also has an experimental textured Hunyuan3D route. Studio's coding agent calls the assigned model and integrates its project-scoped outputs. Only one GPU generation job runs at a time; its processes exit when finished.

**Development-host prerelease. This package does not install or run on stock Genex 0.1.7, or current unmodified `dev`.** Its 35-minute Hunyuan recipe needs an unreleased native-job timeout extension. The tested local host also exposes retained native outputs in Assets before a build lands or after it is canceled. The catalog submission is a draft, not a ready-to-install listing. See [Compatibility](docs/compatibility.md).

Plugin ID: `theastraydev-local-models`. Publisher: `TheAstrayDev`. Version: `0.1.12`. This is the first catalog submission. Version 0.1.12 adds experimental Metal/Vulkan profiles and explicit setup locations; 0.1.11's asset orchestration remains intact. Existing release artifacts are unchanged. The bare `local-models` ID remains a local prototype. The public ID follows the catalog's GitHub-owner naming rule. Do not enable the public package beside the old prototype: their independent plugin locks would not serialize work with one another. This package does not migrate or remove prototype data.

## Platform availability

| Computer | Images / textures | Sound / music | Textured Hunyuan3D |
| --- | --- | --- | --- |
| Windows x64, AMD with a current Vulkan driver | Vulkan | Vulkan | Unavailable |
| Windows x64, NVIDIA | Vulkan on new installs; existing CUDA setup preserved | Vulkan on new installs; existing CUDA setup preserved | Separate CUDA Portable setup |
| Apple Silicon, macOS 26+ | Metal | Metal | Unavailable |
| Apple Silicon, macOS 13.3 to 15 | Unavailable with the pinned image binary | Metal | Unavailable |
| Intel Mac, Linux, Windows ARM | Unavailable | Unavailable | Unavailable |

These are implemented experimental profiles, not a claim of validated inference on every listed GPU. Host OS/architecture/version gates setup and routes. The panel shows driver/memory requirements but does not query the GPU or certify available VRAM. Qwen has about 10 GB of weights; plan for 12 GB VRAM or 24 GB unified memory. The pinned macOS image CLI has a macOS 26 minimum in its Mach-O header; audio has 13.3. A generic Metal backend does not establish that every model fits memory or finishes within five minutes.

**Known Windows Vulkan host blocker:** the LPAC-compatible audio runtime can read its model file, but a real generation attempt on the local Windows host reported no Vulkan GPU registered. The same binary enumerates the RTX 4070 outside that sandbox. The plugin does not bypass the sandbox or silently switch to CPU. AMD end-to-end support therefore remains unverified and depends on resolving host GPU/driver visibility. Existing CUDA installations retain their tested path.

Unsupported models have no Install button and cannot be selected for new work. Existing assignments are retained and blocked explicitly when incompatible. Hunyuan's current texture adapter uses Windows CUDA extensions; neither a Mac/ROCm Hunyuan port nor automatic CPU fallback is claimed. Platform checks inside a plugin cannot hide its entry in the host catalog: catalog-level OS/GPU filtering still needs an agreed host contract.

## What it does

| Task | Implementation | Output |
| --- | --- | --- |
| Images and textures | Qwen Image 2.1 Turbo Q4_K_M, matching text encoder and VAE, stable-diffusion.cpp | PNG |
| Sound effects | Stable Audio 3 Small SFX Q8, audio.cpp | Stereo WAV |
| Instrumental music | Stable Audio 3 Small Music Q8, audio.cpp | Stereo WAV |
| Static 3D | Hunyuan3D 2.0 Turbo, separately provisioned Windows Portable runtime | Textured GLB |

The tested machine has an RTX 4070 12 GB and 32 GB RAM. This release does not implement Linux/macOS, AMD/Intel GPU profiles, rigging, mesh animation, voice, video or a local coding/chat model. Existing model-cache discovery is metadata-only; finding a file does not make an unsupported model assignable. Studio writes game logic, VFX and shaders itself.

There is no paid Genex generation fallback. Platform publishing, identity, multiplayer and purchases remain official Genex features, not local inference. This plugin does not change Genex's executable, install a desktop update, apply a host patch or publish a game.

## How the pipeline works

1. Enable the plugin on a compatible development host. Its panel lets the user assign installed compatible models to image, texture, SFX, music and model routes. Disabled routes stay disabled.
2. Studio reads `theastraydev-local-models__status` and checks retained assets before requesting new work.
3. An inference call takes a plugin-wide filesystem lease. One fixed host `native.run` recipe launches the worker. The agent cannot supply executable paths, shell commands, arbitrary model IDs or output folders.
4. Hunyuan shape and paint run as separate processes. Shape exits before paint loads. All model processes exit after their request; no inference server remains resident. Weights stay on disk and reclaimable OS file cache can remain. Full unloading means cold start is not instant.
5. The host retains original output and delivers it into the bound game/worktree. The tool returns exact `files`, `assets[].url` and a job UUID. `assets` lists that game's completed jobs; `retrieve` restores their original bytes without inference and refuses changed destinations or cross-project jobs.
6. Studio loads the returned URL into the actual gameplay entity. `inspect-use` uses Genex's observation service to report runtime loading and capture the scene. `verify-use` accepts a current successful inspection with the agent's visual note; audio requires advancing audible playback. Delivery alone is not proof of integration.

Cancellation is owned by the host. The lease is held until the call settles, not stolen on a timer. Unknown/failed results must be inspected before retrying. A lost application can leave a lock requiring inspection; the plugin does not blindly delete it.

### Images and reference-to-3D

`generate-image` accepts an object description, optional size 512 or 768, and `purpose`: `asset` (default), `icon`, `model-reference` or `scene`. Isolated purposes automatically use Qwen's documented native RGBA format. Pixel alpha is checked read-only; one failed transparency check gets one sequential retry with a recorded new seed, then an explicit failure. There is no image-editor pass. `task:"texture"` keeps surface tiles opaque; `purpose:"scene"` permits a complete background.

`generate-model` accepts exactly one of `prompt`, `imageJobId` or a project-relative `image` under `assets/` or `public/`. A prompt first generates a Qwen reference and returns `completed:false`, `state:"reference-ready"` and `nextCall`. The agent follows that continuation in a separate call to finish the mesh. Saved references survive mesh failure. A reference PNG is never reported as a completed 3D asset.

Hunyuan receives an image, not a chat system prompt. Its automatic Qwen reference instructions emphasize a complete three-quarter silhouette, readable construction, correct proportions and diffuse light while preserving the requested style. Genuine transparent references keep their alpha; existing opaque references use local CPU preprocessing. The saved source image is preserved.

| Profile | Shape grid | Triangle ceiling | Paint views | Atlas | New Qwen reference |
| --- | --- | --- | --- | --- | --- |
| `balanced` (default) | 384 | 50,000 | 512px | 1024px | 512px |
| `high` (experimental opt-in) | 512 | 200,000 | 512px | 2048px | 768px |

Both use the pinned Turbo weights, eight shape steps, guidance 5 and original surface normals transferred across UV splits. A real same-reference test on the prototype produced noisier paint at higher density. A 768px paint-view experiment was rejected; repainting at trained 512px views did not remove every defect. High is not a guaranteed visual improvement. Single-image hidden geometry, animation-ready topology and full PBR maps are not guaranteed. Neither Hunyuan3D-2mv nor 2.1 is integrated.

### Agent skills

The package has 15 skills: the always-present `local-assets` brief and 14 file cards read through the host's `theastraydev-local-models__skill` tool. They disappear from later briefs when disabled and are not written into the game.

`game-quality` asks the coding agent to interpret the brief, strengthen its creative direction, finish a playable slice and review actual gameplay. Its references cover 3D/materials, renderer-compatible VFX and shaders, performance, camera/input, sound and asset verification. A short request defaults to considered execution. Explicit low-poly/pixel-art styles, narrow scope and rough-output requests remain authoritative. Quality is not equated with maximum polygons or permanent bloom. The other cards adapt the Genex build/asset workflow and route optional platform features back to the official tools. These instructions do not change a model's reasoning setting or guarantee obedience, artistic quality or superiority to another model.

Version 0.1.11 rewrites the always-present lead instructions and adds the `asset-preference` build-orchestration reference. The lead records required roles, generation/integration owners, saved IDs/URLs and distinct generated/integrated/verified states in the existing acceptance plan. One sequential asset owner starts alongside the foundation at the first supported opportunity. Consumers connect final assets before unplanned variations; interrupted workers hand over receipts and useful integration edits. Shared camera/boot failures are repaired at their owner without repeatedly regenerating valid assets. Before accepting an asset milestone or reporting the full build complete, the lead checks the integrated game and names any blocked requirement. These are agent instructions, not an automatic host-enforced gate. No new hooks, permissions, model parameters or shader-generation model are introduced.

## Setup boundaries

**Do not try this package on stock Genex yet.** On a compatible development host, install the prebuilt `package/` directory using the official plugin workflow, approve its disclosed capabilities, then enable it. No npm installation or build hook runs inside Genex. No Hugging Face account/token is used by these pinned public GGUF download routes. Original model terms still apply.

The user-confirmed Install action supports Qwen and Stable Audio. Installing the plugin or assigning a route does not download weights. After confirmation, the plugin downloads and verifies the selected runtime and weights, resumes bounded downloads, checks ZIP/tar paths, stages regular files and preserves different existing files. Python command symlinks are omitted from the macOS archive; the manifest names its real interpreter. The panel and confirmation review show the locations before setup.

| Location | Windows | macOS |
| --- | --- | --- |
| Download cache | `D:\Genex-Local-Models` if D: exists, otherwise `%USERPROFILE%\Genex-Local-Models` | `~/Genex-Local-Models` |
| Qwen runtime and working weights | `%USERPROFILE%\Genex-Local-Models\qwen` | `~/Genex-Local-Models/qwen.app/Contents` |
| Audio runtime and working weights | `%USERPROFILE%\Genex-Local-Models\audio` | `~/Genex-Local-Models/audio.app/Contents` |

Weights live under each runtime's `models/<model-id>/` directory. Cached downloads and working weights are separate copies; account for both when planning disk space. The macOS `.app` layout keeps Python, its libraries, model files and child CLIs inside the host's existing native sandbox boundary. It does not launch a GUI application or change the Genex host. Setup preserves 15 GiB free on C: and 2 GiB on other drives. Cancellation preserves partial downloads for retry. After installation, choose the model for a route and save assignments; Studio can then call it. Model processes start only for a request and exit afterward.

Hunyuan currently needs separate setup. Its Install button is absent; the backend also refuses automatic setup. The prepared runtime is detected at `~/Genex-Local-Models/hunyuan/python.exe` or `D:/Genex-Local-Models/hunyuan/python.exe` on the compatible Windows host. It needs verified portable code, checkpoints, compiled texture extensions and loader preparation described in [runtime notes](docs/runtimes.md). A turnkey Hunyuan installer and a clean-machine acceptance test are outstanding. Arbitrary existing Ollama/LM Studio/Hugging Face models cannot be used merely by selecting their filename.

## Access and data

The backend is trusted native code running in Genex's child process. Capability declarations are disclosures, not an OS sandbox around the backend. Generation itself uses the host's native-job sandbox. The backend reads its own storage, checks runtime/model files and enumerates bounded top-level entries in standard Hugging Face, LM Studio and Ollama caches plus `D:/hf-cache/hub` and `D:/models`. It does not read prompt histories, credential files or account stores. `discover` lists paths/names, not model contents.

| Capability | Use |
| --- | --- |
| `native-runtime` | Detect declared interpreters and run fixed project-bound recipes |
| `project.read` | Bound project input and asset integration authority; no global project-history scan |
| `project.write` | Host delivery/restoration into the bound game/worktree |
| `jobs` | Durable plugin-local job receipts and retained references |
| `observe` | Runtime asset-load, still-frame and audible playback evidence |
| `network` | User-confirmed pinned runtime/weight downloads |

Declared network hosts are `huggingface.co`, `github.com` and `www.python.org`. Downloads can follow upstream CDN redirects. Runtime inference sets offline flags and does not download dependencies. No MCP server, credentials capability, telemetry endpoint or Genex credit/account action is declared. Assignment/recent-job files stay in plugin storage; local prompts can appear in native job receipts. These local records are not shipped in this repository. Removal withdraws tools and skills; retained storage/model directories are not an automatic uninstall target.

## Build and check

Node 24 is required. The repository contains both authoring source and the prebuilt package referenced by the catalog record.

```sh
npm ci
npm test
npm run check
npm run build
python -m pip install -r tests/requirements.txt
npm run test:worker
```

The Python tests need Pillow, NumPy, SciPy and trimesh, not GPU weights. The TypeScript tests cover assignments, argument validation, sequential execution/cancellation, download integrity, hostile archives, retained-job ownership, continuation and integration evidence. On a nearly full Windows C: drive, point TEMP/TMP at a volume with space; tests do not disable the installer's reserve.

From a compatible Genex checkout run `npm run plugin:doctor -- /path/to/package`. The stock validator currently rejects the 35-minute recipe before activation; that failure is a compatibility blocker, not a passing stock check. `GENEX_SOURCE_DIR=/path/to/compatible-checkout node scripts/check-host.ts` exercises disposable-registry install, a harmless status/assets call, same-session tool availability, skill reads, update preservation and disable/remove. It does not use the normal Genex profile. See [validation](docs/validation.md) for exact evidence and unverified cases.

## License and attribution

Plugin authoring code: [MIT](LICENSE), TheAstrayDev. Genex SDK, panel bridge and adapted skill topics retain [Genex's MIT notice](vendor/LICENSE.genex). Bundled ZIP/tar dependencies retain their MIT/ISC notices in the prebuilt package. Windows audio.cpp compatibility builds are Apache-2.0 derivatives at the pinned revisions; their LPAC path-only modification and build recipes are public. `scripts/patch-audio-source.py` documents the changes. External Python distributions retain their Python and component notices. The copied background-removal preprocessing retains the rembg notice.

External runtimes and model weights are separate downloads and retain their own terms: [Qwen](https://github.com/QwenLM/Qwen-Image-2.1), [Stable Audio](https://github.com/Stability-AI/stable-audio-3), [audio.cpp](https://github.com/0xShug0/audio.cpp), [Hunyuan3D](https://github.com/Tencent-Hunyuan/Hunyuan3D-2) and [Windows Portable](https://github.com/YanWenKun/Hunyuan3D-2-WinPortable). The plugin's MIT license does not relicense those weights, the portable GPL runtime or auxiliary components.

AI-assisted implementation, tests and documentation with OpenAI Codex. The contributor remains responsible for the submission. Maintainer: [@TheAstrayDev](https://github.com/TheAstrayDev); report problems in this repository's issues. This is an independent community plugin, not an official Genex release.

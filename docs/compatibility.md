# Host compatibility

## Source update 0.1.14

The saved task assignments now include Qwen Turbo Q4/Q8 and Hunyuan3D Turbo/Mini Turbo. Existing choices and Off remain valid. Q8 and Mini have workflow/command tests, not real GPU acceptance or measured five-minute completion. The Mini shape checkpoint requires separate manual setup and uses the existing Turbo painter. A model selected for a staged 3D request remains pinned across later default changes.

The accompanying Genex host change retains and selects `nativeRuntimes[].platforms` and resolves reviewed absolute drive paths on Windows. It is required for a prepared runtime available only on a secondary drive. Earlier hosts retain the portable home-alias fallback; this update does not imply every older Genex can find a D:-only runtime. Sandbox grants, five-minute job limits, cancellation and project delivery are unchanged. The catalog submission remains draft.

## Earlier 0.1.13 acceptance

Version 0.1.13 follows the maintainer five-minute policy in [#170](https://github.com/genex-games/genex-desktop/issues/170#issuecomment-6233006335). Image, audio, model-shape and model-paint each declare 300,000 ms. Shape and paint use separate native jobs and outer tool calls. The completed shape and prepared reference are retained before paint starts; incomplete painting is reported with saved shape URLs. No host timeout extension is needed to validate or pack this release.

The stock native-manifest validator and plugin:doctor accept the package with the 300,000 ms limit unchanged. This removes the previous declaration rejection, without establishing released-host inference on every platform. Long background jobs, explicit maximum-duration approval and asynchronous start/status/result remain separate host work in [#184](https://github.com/genex-games/genex-desktop/issues/184).

Windows Hunyuan requires NVIDIA CUDA and a separately prepared Portable runtime. RTX 4070 12 GB VRAM / 32 GB RAM is the tested configuration, not a universal minimum or a promise that slower devices finish inside five minutes. Balanced and explicit high keep their original quality parameters. Timeouts do not trigger a downgrade, duplicate generation or paid fallback. Paint uses staged read-only copies of a completed shape/reference. Host cancellation and process-tree cleanup remain in force.

Experimental Apple Silicon Metal and Windows Vulkan image/audio profiles remain. Existing verified CUDA setups stay on CUDA. Windows Vulkan GPU visibility, actual Apple Silicon/AMD inference and clean-machine Hunyuan provisioning remain outstanding. See the [platform matrix](../README.md#platform-availability) and [validation scope](validation.md).

The plugin checks OS/architecture/version and displays graphics/memory requirements, but does not certify GPU memory. The catalog contract does not filter entries by OS/GPU. The catalog PR remains draft pending supported released-host fresh install/use/update/remove acceptance and maintainer review/upload of the approved-origin artifact.

No application port, host patch, sandbox bypass or catalog policy change is included. `compat/inspection-budget.patch` is historical evidence for versions through 0.1.12; do not apply it for 0.1.13. The bare local-models prototype and public package retain separate identities and leases; do not enable both. No prototype permissions, assets or data are silently migrated or removed.

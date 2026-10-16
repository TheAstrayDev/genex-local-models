# Host compatibility

This release is a development-host proposal. It is not stock Genex support.

- Latest released Genex checked: `v0.1.7`.
- Upstream `dev` checked: `06741ab9a9c5ae215272803f61eb2dcd1eff2804` (2026-10-16).
- `src/substrate/plugins/native-manifest.ts` on that commit caps native jobs at 300,000 ms. This package requests 2,100,000 ms for Hunyuan, so stock package validation rejects it. Setting a minimum app version in a catalog record would not fix this.
- The local test host permits the 35-minute recipe and outer call budget. It also recognizes retained native outputs in the Assets inventory before landing/after cancellation and supports their contained previews. Those are not dependencies on the Usage-Streak customization API.
- The plugin itself does not change the host, install any patch, replace `app.asar` or require a Windows desktop installer from this repository.
- The requested long-job policy is discussed in [genex-desktop #170](https://github.com/genex-games/genex-desktop/issues/170). Its implementation is a maintainer decision; opening the issue does not resolve the package rejection.

Version 0.1.12 adds image/audio profiles for Apple Silicon Metal and Windows x64 Vulkan (AMD/NVIDIA). See the [platform matrix](../README.md#platform-availability). Existing verified Windows CUDA setups stay on CUDA. This is not a Windows Genex port, Linux support or a Mac/AMD Hunyuan adapter. Runtime startup tests do not establish model inference quality, memory use or host sandbox performance on that hardware.

The setup panel disables incompatible models and reports concrete requirements. The catalog/manifest contract checked here does not filter catalog entries by OS/GPU. Extra unrecognized fields would not implement that behavior, so this submission does not invent a `platforms` catalog field or claim the host filters it. An agreed host-side listing contract remains needed before a restricted listing can be considered complete.

The catalog PR must remain draft until supported-host compatibility and clean install/use/update acceptance are resolved. Listing is a maintainer decision. This source release is provided for review, not a recommendation to weaken validation or bypass the install dialog. No app port, host API change, catalog policy or catalog workflow change is included in the submission.

For disposable package inspection only, `compat/inspection-budget.patch` records the two-line budget extension against the pinned `dev` commit. A reviewer can apply it to a separate test checkout and run `plugin:doctor`, official packing and `scripts/check-host.ts`. It is not a complete Windows runtime/Assets port, does not establish real inference compatibility, and is never applied by this plugin. The stock rejection and patched fixture success are reported separately.

The local bare-ID prototype and this publisher-prefixed package are different identities. There is no silent migration of existing grants, receipts or assets. Do not enable both together, because their per-plugin generation leases are independent. Existing prototype data must remain intact.

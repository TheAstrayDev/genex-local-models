# Validation scope

## Source update 0.1.14

- 50 Node tests pass: saved/Off choices, incompatible assignment refusal, one parallel probe per runtime family, activity reads without probes, model-pinned 3D continuations and reuse, verified shared-weight reuse, plus the existing generation/install/asset boundaries.
- 17 Python tests pass without model weights: fixed Q4/Q8 diffusion paths, fixed Turbo/Mini checkpoint selection and existing worker/mesh checks.
- 18 Electron panel checks pass in an isolated SDK fixture: light/dark themes, keyboard save, narrow layout, preserved drafts on refresh/failure, model details and cheap activity updates. Screenshots show this fixture, not a live Genex game.
- TypeScript checking passes. Production packaging and the disposable real-host registry fixture are rerun for this source version; the machine-readable check result records their scope.
- The accompanying host change has 107 passing focused native/SDK tests and three platform skips. Its full static chain stops at five pre-existing test-style findings in unrelated files; typechecking and changed-file lint pass.

New Q8/Mini inference, GPU memory fit and cold five-minute completion remain unverified. No model weights were downloaded for these checks. The earlier LPAC findings below describe the historical tested host; they are not evidence that the same failure persists in current Genex. The public catalog PR remains draft pending its real-host acceptance gates.

## Earlier public-package evidence

This first public package uses a new publisher-prefixed identity. Evidence from the earlier local `local-models` prototype is labeled separately; it is not represented as clean stock-host acceptance of the public package.

## Public-package checks

- 40 TypeScript tests: route and argument boundaries, queues/cancellation, download integrity/archive paths, OS/architecture/version availability, sandbox runtime roots, incompatible-route rejection before generation, confirmed setup disclosures, project-scoped asset restoration, separate reference/shape/paint continuations, paint timeout/cancellation retention, duplicate prevention by input digest, stock-limit manifest declarations and runtime integration evidence.
- 14 Python tests: fixed Metal/Vulkan/CUDA commands, native RGBA prompts and read-only alpha validation, one bounded retry, model command boundaries, reference masks, failed paint handling and UV-split normal transfer.
- TypeScript checking and production build.
- Disposable real Genex registry: install, enable, harmless `status`/`assets` calls with one unchanged chat binding, all 14 file skills/five references including the new orchestration guide, synthetic previous-version update preserving assignments, disable/remove withdrawal and retained storage. The asset reference is readable through its owner and refused through another skill. No inference, account access or real chat session is used by this fixture.
- Linux source CI originally failed the existing hostile-path assertion on 0.1.9: POSIX path resolution treated `C:/elsewhere` as a relative child. Version 0.1.10 rejects POSIX, Windows drive/root/UNC and drive-relative absolute forms before resolution on every host. The assertion was preserved and its hostile-input table expanded.
- Stock five-minute native-manifest validator and plugin:doctor: accepted 0.1.13 without changing timeout policy. Validator/registry files are unmodified at host commit `9db4fe402193436192ede1211a8a97690c219ef6`. This is package/registry acceptance, not full released-host inference.
- New profile interpreter imports and CLI startup pass without model weights on Windows and Apple Silicon CI. Mac temporary-path aliases are compared after canonical resolution; the runtime still resolves its real application boundary.
- Windows LPAC regression: the unmodified Vulkan audio executable failed ancestor normalization. The separate reviewed compatibility build reaches the malformed-GGUF parser. A real audio generation attempt then exposed missing Vulkan GPU visibility inside that host; no inference completed. This is recorded as a remaining blocker, not a passing AMD generation test.

`scripts/check-host.ts` requires an explicit host checkout through `GENEX_SOURCE_DIR`. Version 0.1.13 passed against the unchanged validator/registry at the commit above. It reports evidence under ignored `.evidence/` and never patches the host or touches a normal app profile. The disposable consent callback is synthetic and allows only status/assets reads. This does not prove real UI consent or GPU sandbox acceptance. All native recipes declare 300,000 ms. The historical `compat/inspection-budget.patch` is no longer needed or applied.

## Version 0.1.13 real cold-stage check

On the existing local Windows LPAC host, RTX 4070 12 GB / 32 GB RAM, a disposable project ran the actual 300,000 ms model-shape recipe. It wrote a 50,000-triangle GLB and the prepared reference PNG. The trusted runtime exit marker was 297.5 seconds after native job creation. Host access recovery then failed, and the final native record is failed after about 325.7 seconds. Painting was not started. This is a host cleanup failure, not a passing two-stage inference or a claim that every cold request completes inside the tool budget. A separate run of the same trusted CleanupOnly operation completed successfully and wrote cleanup.ok. The host was not patched to make this pass. The failed job and recovery records remain in the private test directory; no personal profile or game was used.

The fixture tests independently prove that a completed shape remains retrievable when a later paint job fails, times out or is canceled, and repeated continuations do not restart it. Full two-stage real inference on an accepted released host remains a listing gate.

## Earlier real inference on the local prototype

Windows x64, RTX 4070 12 GB, 32 GB RAM, local Genex 0.1.7-ui2 with native-job/retained-library extensions. Generated outputs were delivered through the host and workers exited sequentially. Examples include a native RGBA icon (76.0 s), native RGBA reference (46.4 s) and a balanced textured GLB (392.9 s). Cold starts vary with cache and disk.

A 200k-triangle High experiment took 449.4 s with 768px paint views. It added visible paint noise. A separate trained-512px repaint of the same shape/reference took 137.4 s and did not remove every defect. These are separate experiments; their sum/difference is not an end-to-end benchmark of the final preset. Final High keeps trained 512px views and remains opt-in. Surface-normal export tests preserved geometry, UVs and texture pixels.

The installed local prototype's 0.1.8 → 0.1.9 update retained model assignments and other plugins, and Genex reopened with a responding window. The `game-quality` skill and its references were read back from the installed package. This is earlier prototype evidence, not a local install of the public 0.1.11 package. No complete game quality benchmark establishes a model-to-model superiority claim.

Version 0.1.11 changes guidance and reference registration. It does not implement a host-enforced completion gate or change generation code, model parameters or runtime setup. Its scheduling/handoff/review instructions cover new builds, resume with retained jobs, shared-camera failures, observation limitations and explicit no-generation requests. Validation proves that the right guidance is packaged and accessible, not that every coding model will obey it or that a full game passed these requirements.

## Outstanding before listing

- Full released-host inference and retained-asset UI behavior. The native-job declaration budget blocker is fixed in 0.1.13.
- Fresh stock Genex install and harmless real chat call, same-chat activation, public-ID update/remove acceptance in the actual UI.
- Turnkey Hunyuan setup and clean-machine validation of its portable code/texture extensions/loader.
- Real model inference on Apple Silicon/AMD, beyond pinned interpreter/CLI startup and fixture tests.
- Catalog-level platform visibility, which the current host contract does not implement.

The PR template keeps unverified conditions unchecked. A green catalog identity/history check does not establish any of these runtime properties. The approved-origin artifact publication step also requires a maintainer's review and upload.

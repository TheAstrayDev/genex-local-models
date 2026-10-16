---
name: genex-threejs-multiplayer
description: Add optional Genex multiplayer while keeping locally generated meshes and sounds as static game assets.
---

# Local assets, hosted networking

Local Models has no relay, matchmaking or authority server. Read the current `genex__skill {"name":"genex-threejs-multiplayer"}` before networking code; use its declared references for the relevant movement/host pattern. Do not copy a stale networking implementation from these adapter notes.

For a package-managed game, `genex__package {"package":"@genex-ai/multiplayer"}` installs the host-pinned multiplayer and identity dependencies through its normal approval. Do not vendor the SDK by hand into an import-map-only template or run a global CLI installer. Confirm project compatibility before committing to this feature.

Studio's local preview can prove controls and rendering, not live Genex multiplayer. Use an authorized hosted draft for owner testing in two tabs; friends need the public release. Do not publish merely to test a locally generated asset. Until the hosted scenario is exercised, say multiplayer is unverified.

Generate shared visual assets once during development. Synchronize stable entity IDs and gameplay state, not model weights or local generation jobs. Remote players cannot call the author's desktop plugin or depend on its file paths, GPU or localhost. Use the project's authority and interpolation patterns and keep single-player usable when the connection fails.

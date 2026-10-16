---
name: genex-tool-publish
description: Check that local model outputs ship in a static export before using the official Genex draft or gallery publishing tools.
---

# Export a game with local assets

Read `genex__skill {"name":"genex-tool-publish"}` before a requested publication. Keep Genex's current static export and platform glue; Local Models does not change hosting or account APIs.

Verify every referenced GLB, PNG and WAV is inside the game's build or public root and appears in the export. Do not reference plugin storage, absolute Windows paths, localhost model services, HF weights or a file that exists only in the editor. Keep three.js and its addons on the project's existing matching version; check vendored dependencies are actually included. Fix missing references rather than disabling export checks.

Local outputs normally land under `assets/theastraydev-local-models/<jobId>/`; place or import them using the existing bundler convention. GLBs from the current profile embed their textures, but inspect any later optimized version for external references. Keep the export lean: ship game outputs only, never model runtimes, debug PLY files, download caches or weights.

Validate the production build before upload. For Studio-built games follow the cover skill; do not alter a publish-only imported game against the owner's wishes. Use the normal `genex__publish` approval and wait for `genex__publish-status`. Quote the server's actual error and warnings; do not label every failure an internet problem or claim a public release from a draft URL.

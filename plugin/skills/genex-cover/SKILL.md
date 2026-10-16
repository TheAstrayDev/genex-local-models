---
name: genex-cover
description: Stage and capture an honest 16 by 9 gameplay frame using Genex cover tools after integrating local assets.
---

# Capture the implemented result

Read the current `genex__skill {"name":"genex-cover"}` before implementing Studio's cover demo. Use the game's own loaded models, lighting and effects. Hide HUD and debug overlays; do not add objects, text, relighting or generated imagery that players never see.

For a Studio-built game use its `config.demos` entry named `genex-cover`. Preload required assets during normal boot; the demo stages synchronously, sets an absolute reproducible camera and state, then calls `window.__studio.pause()`. Respect the host's viewport and resize handling. Do not touch saves or player progress during a shot.

Check `genex__cover {"operation":"status"}` before publishing. If needed shoot with `genex__cover {"operation":"shoot"}` and judge the actual preview. A generated image or a brightness number cannot replace that judgement. An owner-picked cover always wins. A dark-by-design game stays dark.

Capturing is not uploading: publication sends through its own flow; a separate `genex__cover-set` requires its normal user approval. Preserve reported failures and warnings. With absent cover tools, describe the limitation rather than inventing `theastraydev-local-models__cover`.

---
name: game-quality
description: Turn a Genex game brief into a distinctive, polished playable result; direct local asset models, 3D, VFX and shaders, then review actual gameplay before claiming quality.
---

# Game quality

Use this for a requested game build, art pass or gameplay improvement. Studio's coding agent owns design, code and verification; Local Models supplies assigned image, mesh and audio routes. Apply these decisions with any coding model. A skill guides a model; it cannot change its capabilities, context limit or available tools.

## Quality is the default

Deliver a considered, complete experience without making the user write a production specification. A short prompt is not permission for a disposable demo. Lower fidelity only when the user explicitly requests rough, deliberately crude or unfinished output. A prototype, small scope, low-poly style, pixel art or mobile target still deserves coherent art, good input and a finished playable loop. Quality means execution appropriate to that style, not universal photorealism, maximum polygons or maximum effects.

For an explanation or planning-only request, give the design without running generation or changing the project. For a narrow repair, apply this to the affected experience; do not redesign the entire game. Honor the user's explicit mechanics, tone, references, assets, limits and existing edits. Do not add accounts, monetization, multiplayer, downloads or paid services as an unsolicited quality upgrade.

## Read the brief before expanding it

Separate explicit requirements from inferred choices. Identify the player's fantasy, core action, genre, camera, intended mood, platform and existing constraints. When unspecified, choose compatible defaults and briefly state the consequential ones; ask only when a missing choice would materially change the requested game.

Convert the brief into a compact working direction:

- **Promise:** what the player does, why it feels good and what makes this interpretation memorable.
- **Look:** silhouette language, material treatment, restrained palette, lighting, camera and UI hierarchy that belong together.
- **Feel:** movement response, feedback, pacing, sound and progression for the core loop.
- **Signature moment:** a relevant visual or interactive payoff that supports that loop, rather than an unrelated feature list.
- **Proof:** observable conditions for gameplay, asset use, visual finish and performance.

Enrich the idea through specific, compatible choices. For a neon racer, road reflections that clarify the racing line and a responsive boost trail help the fantasy; an inventory, battle pass and random weather system do not automatically improve it. For a quiet exploration game, atmosphere, spatial sound and restrained particles may be stronger than explosive effects. Keep this direction brief and implement it; a long plan is not the deliverable.

## Build a polished vertical slice

Inspect the current project and renderer before choosing effects or libraries. Reuse working loaders, input, materials and assets. Get the real movement/camera, goal, feedback, failure and restart loop playable, while scheduling requested local assets early. Then finish the most visible moment before multiplying levels, menus or systems. Basic shapes may block out a scene during development; do not leave incidental blockout art in the finished hero presentation unless that is the chosen style.

Prioritize the things the player continuously sees and feels: hero object, camera, main surface, lighting and action feedback. Give secondary objects a coherent lower-cost treatment. Avoid a detailed hero floating in an empty, unlit scene or a polished menu attached to broken controls. Finish loading, HUD legibility, sound unlock, transitions and restart behavior as part of the playable result.

Before substantial 3D, VFX or shader work, read `skills/game-quality/references/visual-craft.md` with `theastraydev-local-models__skill {"name":"game-quality","file":"skills/game-quality/references/visual-craft.md"}`. It covers reference composition, geometry, materials and effects supported by the actual renderer.

## Direct the available models precisely

Read `theastraydev-local-models__skill {"name":"genex"}` and `{"name":"asset-preference"}` once if they are not already in context, then check `theastraydev-local-models__status` and `theastraydev-local-models__assets`. Reuse loaded skill text instead of recursively following links back to this card. Reuse suitable retained jobs. Studio writes game logic and shaders; Qwen, Hunyuan and Stable Audio are task-specific generators, not coding agents. Keep GPU generation sequential and preserve exact job IDs and delivered URLs across every handoff.

Write prompts in concrete visual or acoustic terms: subject and function, proportions, construction, materials, style and the few details that matter from the gameplay camera. Match each prompt to its route and to the same art direction. Do not rely on adjective piles such as "masterpiece, ultra quality, 8K". Qwen's isolated asset/reference wrapper already requests native transparent RGBA. Use `task:"texture"` for surface tiles and `purpose:"scene"` only when a full background is wanted.

For Hunyuan, follow the returned `nextCall` until an actual mesh exists, then inspect it. Choose the best visible result rather than the largest parameter. `quality:"balanced"` remains the tested default; `quality:"high"` is an explicit higher-density experiment that can produce noisier paint. A request for a beautiful game alone does not make High a guaranteed upgrade. Do not invent a Hunyuan system-prompt field, rigging tool, PBR map generator or animation capability. Preserve a usable previous asset before a new attempt. Regenerate only to address an observed defect with a concrete input or parameter change; a failed or unknown job must be resolved before another request.

## Review what the player gets

Read `skills/game-quality/references/quality-review.md` before the finish pass. Exercise the actual playable build and inspect representative frames and errors with the observation/test tools the host really exposes. After integrating a generated asset, call `theastraydev-local-models__inspect-use {"id":"<returned-job-id>"}` and record `theastraydev-local-models__verify-use` only when that inspection supports the claim. File existence, a generation receipt, source code and an attractive reference image do not prove in-game use or quality.

Fix the weakest visible or interactive result first, then recheck the affected loop. If generation or rendering reaches a real capability limit, preserve the working version and name the remaining defect. Do not disguise a missing requested model with a primitive or claim a full game was tested from one screenshot. Stop when the promised slice works, the quality defects found in that slice are resolved and checks pass. Report what was nplayed, seen or heard and what remains unverified; never promise that a skill guarantees another model's artistic quality.

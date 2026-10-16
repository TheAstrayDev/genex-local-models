---
name: genex
description: Build a playable Genex game using local image, audio and mesh models automatically, from the brief through asset integration and verification.
---

# Build with Local Models

When the user requests a game, Studio's coding agent implements it and delegates asset generation to the installed local models. Preserve the existing project, renderer and user edits. Read the project's instructions and inspect its asset-loading convention before choosing paths or packages. Do not write these plugin skills into the game or install another Genex CLI.

Before planning a new game or its art/feel, read `theastraydev-local-models__skill {"name":"game-quality"}` once if not already loaded. Turn the brief into a compact creative direction and a polished playable slice, including the relevant 3D, VFX, shaders and runtime review. A short prompt does not imply permission for a generic unfinished demo; preserve explicit style and scope choices.

Build a playable loop and schedule one local asset owner alongside foundation work at the first host-supported opportunity. Explicit requests for generated 3D, textures, music or sounds become required acceptance entries with generation/integration owners and retained IDs/URLs; procedural placeholders do not fulfill them. Read `theastraydev-local-models__skill {"name":"asset-preference"}` and its build-orchestration reference, call `theastraydev-local-models__status` and check `theastraydev-local-models__assets` for reusable jobs. Consume delivered final assets before requesting unplanned variations, and review the integrated candidate before completion. Use the assigned routes:


| Need | Tool and arguments |
| --- | --- |
| Isolated image / icon | `theastraydev-local-models__generate-image`: `name`, `prompt`, optional `purpose:"icon"`, `size:512`, `seed:42`; native transparent RGBA is automatic |
| Object reference | Same image tool with `purpose:"model-reference"` for a transparent three-quarter silhouette |
| Full illustration / cover | Same image tool with `purpose:"scene"` to keep its background |
| Surface texture | Same tool with `task:"texture"` |
| Sound effect | `theastraydev-local-models__generate-audio`: `name`, `prompt`, `task:"sfx"`, `duration:5`, `seed:42` |
| Instrumental music | Same tool with `task:"music"`, initially `duration:15` |
| Textured 3D from text | `theastraydev-local-models__generate-model`: `name`, `prompt:"A painted wooden treasure chest with brass bands..."`, `seed:42`; transparent Qwen reference then Hunyuan3D |
| 3D from a generated reference | Same tool with `imageJobId` equal to a completed image job UUID |
| 3D from a project image | Same tool with `image` equal to an existing path under `assets/` or `public/` |
| Existing job | `theastraydev-local-models__retrieve`: `id` equal to a returned job UUID; restores into this workspace without generation |

`name` is a lowercase slug of at most 40 characters. Prompts are at most 2000 characters. Supported image sizes are 512 and 768, with only 512 benchmarked. Audio accepts 1–120 seconds; start short because long requests have not been benchmarked. No tool argument selects a model, URL, command or output directory. For focused prompt recipes read `skills/genex/references/asset-recipes.md` through this skill's `file` argument.

Choose exactly one of `prompt`, `imageJobId` and `image` for a mesh. Text-to-3D retains the reference if Hunyuan3D fails: reuse the reported image job ID on retry. No manual copy is needed. A texture is not an object reference: generate a clean single-object view for a car, character or prop.

In a coordinated build, one owner handles local GPU assets sequentially. Pass every requested category, completion criterion and existing job ID to it. Other workers consume the agreed asset API. When replanning, preserve completed files and transfer job IDs instead of instructing the foundation to discard them. If a placeholder is needed during development, keep the generated asset as required work and verify it before declaring completion.

After each tool returns, use its exact `files` and `assets[].url`. Do not retype, shorten or reconstruct UUID paths. Read `skills/genex/references/integration.md` before wiring assets. Check gameplay, missing asset requests, camera framing and audible playback after a user gesture. A completion report lists what was actually integrated and which requested categories remain incomplete.

There is one GPU model job at a time. Each worker exits after its request. Cold loading costs time; do not promise immediate wake-up or keep models alive with a new server. This plugin does not provide code generation by another LLM, rigging, animation, voice, video, runtime NPC inference, hosting or multiplayer. Use the relevant optional platform skills for those features; never invent a local tool for them. Unsupported features do not block ordinary offline game development.

For text-to-3D, a prompt returns `state:"reference-ready"`, `completed:false` and `nextCall`. Immediately execute the returned tool and arguments to generate the mesh. This is already part of the authorized request; no user action or manual file copy is needed. Never report a saved reference as completed 3D.

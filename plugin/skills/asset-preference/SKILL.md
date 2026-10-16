---
name: asset-preference
description: Choose and integrate local generated assets during a requested game build, without needing a separate request for each model.
---

# Local assets during game development

Local Models is the user's dedicated asset pipeline. When building a game or changing its art or sound, include a small useful asset set in the implementation and execute it within the requested scope. Do not wait for the user to name Qwen, Stable Audio or Hunyuan3D. Respect explicit choices such as procedural-only, an existing asset library, no audio or a different provider. Planning-only and status requests do not start generation.

Reuse suitable project assets first. During execution call `theastraydev-local-models__status`; its assignments and ready flags are authoritative. Use the assigned compatible model rather than choosing a model ID in tool arguments. These are asset models, not coding assistants: Studio's main agent owns game code and integration.

Generate sequentially. Do not fan out local GPU tools to workers. Continue independent coding only if the host supports it while a call runs; never create another model request to check progress. Save returned job IDs and use `theastraydev-local-models__retrieve` for known jobs. If a call times out without a job ID, inspect status and report uncertainty before any retry.

Preserve returned `files` paths and inspect the generated result. Load assets in the playable scene and verify they actually render or play. A generated PNG is not proof of a seamless texture, transparent background or useful composition; a GLB is not proof of animation, collision or sensible scale.

Missing or unassigned model: name the actual blocker and direct the user to Plugins → Local Models. Do not install large weights, change assignments, request tokens or run download commands through game code. A temporary procedural fallback should be disclosed. Never silently switch to credit-billed Genex generation.

Honor every requested category as required work. A foundation worker may use a temporary stub, but its coordinator must keep generated assets assigned and scheduled early, pass retained job IDs across owner changes, and reject completion with assets still missing. Preserve already integrated files and adapt their wrapper when changing the module contract.

For 3D, call `theastraydev-local-models__generate-model` with `name` and `prompt`, or `imageJobId` to reuse a completed object reference. No manual copy is needed. For resumed or stopped builds, call `theastraydev-local-models__assets`, then `theastraydev-local-models__retrieve` for reusable jobs. Retrieval restores into this workspace and registers files in Genex Assets without inference. Use exact `assets[].url` and verify there are no failed asset requests.

# Lead the asset pipeline through gameplay

Use this when coordinating a game build or art pass with generated content. This is guidance for the lead and its workers, not an enforced host hook or a new tool. Use existing planning/acceptance and handoff mechanisms; do not add an orchestration service, telemetry or a live debug panel to the game.

## Make ownership and completion visible

Before delegating, record the actual requested/relevant categories in the existing build plan or module contract. Each entry needs the asset's gameplay role, required/optional status, one generation owner, its integration owner, saved job ID and exact delivered URL when available, and the evidence still needed. A concise row is sufficient:

| Role | Requirement | Generate / integrate | Saved result | Current state / remaining proof |
| --- | --- | --- | --- | --- |
| Hero vehicle | Required generated 3D | Asset owner / vehicle owner | Returned job ID + URL, when ready | Planned → reference ready → mesh delivered → integrated → verified |
| Road surface | Required texture | Same asset owner / world owner | Returned image job ID + URL | Applied to the visible road, tiling reviewed |
| Driving feedback | Required SFX | Same asset owner / audio owner | Returned audio job ID + URL | Audible event after gesture; observation limitations stated |

These are examples, not a mandatory racing-game template. A 2D game may need icons/sprites rather than meshes; a procedural-only game may need no model calls. Include environment art, secondary models, music and other categories when they are part of the person's request or agreed direction. Never omit an explicitly requested category because a minimal demo already runs. Do not invent a quota of model calls to demonstrate "maximum use".

## Start assets without waiting for a polished foundation

Check route readiness and this project's retained jobs before launching new work. Establish the loader/consumer interface early so assets do not depend on finished gameplay. If the host supports independent workers, schedule one asset owner at the start alongside foundation code. Give that owner enough time for cold loading, sequential inference and integration. A foundation-only brief is valid for its code owner, but the lead remains responsible for scheduling the asset work.

If the host cannot overlap coding and generation, start an independent reusable hero/reference task before discretionary foundation polish, or schedule it at the first supported opportunity. Name any readiness, capacity or consent constraint rather than implying a model is generating when no job was submitted. Do not launch multiple GPU owners to compensate for slow cold starts. If memory is tight, reduce concurrent code workers or postpone optional work instead of losing the in-flight job.

## Consume completed work before requesting variations

Prompt-to-3D has two calls. Follow `nextCall` with the exact retained reference to finish the mesh. A reference PNG is an intermediate input; it need not become an in-game billboard and does not satisfy a requested 3D model.

After a final game asset is delivered, send its exact ID/URL, intended role, scale/orientation/material needs and consumer interface to the integration owner. Connect it to the real entity or event before spending another generation on an unplanned variation of that role. The asset owner can continue other already-planned categories while the consumer integrates, if the host supports it; GPU calls themselves stay sequential. Do not let vague "integration later" accumulate a pile of unused assets.

Keep a usable retained asset while addressing a specific observed defect. A new generation needs an identified problem and a concrete prompt/parameter change, not merely a new worker, an empty worktree or a preference for larger numbers. Higher Hunyuan density can worsen paint; inspect before replacing the existing model. Do not claim music was made when only an engine SFX exists, or a whole city was generated when only an asphalt tile exists.

## Resume from receipts and integrate accepted code

After interruption, list the current project's retained jobs and use `retrieve` for saved results. Respect project ownership and modified-file refusal; do not bypass them by copying another game's storage or overwriting edited assets. Carry completed IDs, exact URLs, consumer interface, useful code changes and the remaining defect into the replacement worker's brief.

A failed camera/boot check is a shared code defect, not a defect in every generated file. Assign one owner to fix that shared issue, preserve the assets and pending integration changes, then rerun the affected check. Avoid cycling through replacement asset workers that each start a new mesh while all inherit the same broken camera. Keep test requirements intact; a blocked check stays blocked.

The lead must merge/accept the integration code through the host's normal workflow and inspect that integrated candidate. An asset visible only in an unaccepted worker copy is not a verified finished-game asset.

## Accept evidence, not a promise

For each required game asset, inspect actual runtime loading and the resulting frame or playback. Use `inspect-use` and only then `verify-use` when current evidence supports the claim. A loader returning null, a procedural stand-in, a reference image, a screenshot from a different worktree or a successful generation receipt is insufficient. Check bounds, orientation, grounding, material appearance and the exact game's camera. Texture tiling requires looking at the applied surface; sound requires triggering and listening after unlock.

If the host cannot observe a playback route such as a detached Web Audio buffer, report that probe limitation and use an available real playback check without pretending `verify-use` passed. Do not declare the category verified from source code alone. Do not replace working audio code with an unrelated player merely to satisfy a probe. Keep the requirement pending if the necessary proof is unavailable.

Before a milestone is accepted and before the final completion claim, reconcile the plan against the current integrated game. Required entries must be integrated and verified, or explicitly blocked with the result preserved and the exact reason named. Optional deferrals must be identified. Do not call a blocked full request complete because its procedural foundation runs. Report generated, integrated and verified as distinct states.

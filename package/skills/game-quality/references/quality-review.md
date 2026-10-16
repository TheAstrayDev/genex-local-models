# Review the playable result

Evaluate the promised game slice, not a hypothetical shipped product. Reopen the brief and check explicit requirements alongside the chosen artistic direction. Use the host's actual available observation, browser and test tools; do not invent a tool name or write a claim before seeing its evidence. Keep diagnostics and temporary captures out of the game's public export.

## Evidence worth collecting

| Area | Exercise and inspect | Failure requiring work |
| --- | --- | --- |
| Core loop | Start, move, perform the main action, reach success/failure, restart | Unresponsive input, no understandable goal, stuck state, duplicate entities/listeners after restart |
| Camera and readability | Move through a representative scene and inspect a busy moment | Hero leaves frame, collision blocks view, hazards blend into scenery, HUD covers the action |
| Requested assets | Load the returned URL in the real entity and use `inspect-use`; look at the attached frame | Missing request, loader stub, placeholder still visible, sideways/floating model, reference image mistaken for mesh |
| 3D finish | Compare silhouette, surfaces, grounding and scale from gameplay angles | Background slab, broken thin parts, paint noise, lost materials, severe shading seams |
| VFX / shaders | Trigger the actual event; inspect onset, peak, fade and overlapping events | Effect always on, clipped/sorted incorrectly, unreadable scene, shader error, growing particle count |
| Sound | Unlock with a user gesture, trigger cues and listen at a representative mix | Muted output, clipping, inaudible feedback, music masking cues, duplicate audio after restart |
| Performance | Observe frame time in representative action at the target viewport/hardware | Sustained frame-time regression, large stalls, unbounded memory/effect growth |
| Runtime and layout | Check console/network errors, asset loads and intended viewport sizes | Missing files, rejected shader, clipped controls, loading state that never completes |

A still frame supports appearance, not motion, input latency, sound or frame rate. A programmatic load supports loading, not that the player can see or hear the asset. If interaction, audio or performance could not be tested, say exactly that rather than marking it passed. Use the project's frame-time target; a measured result is required before claiming smooth 60 fps. Do not add a benchmark service or new telemetry to the user's game merely to run this review.

## Choose the next improvement

Rank observed defects by their effect on the player. Broken requested functionality, missing assets and input/camera problems come first; then weak hero presentation, lighting/material problems and unreadable feedback; minor decoration comes later. Fix the responsible layer and retest what changed. Preserve a working build and retained assets before experiments.

When a result is merely bland, identify a concrete cause before regenerating: generic silhouette, no focal contrast, identical material response, flat timing, empty space without purpose, or effects detached from the action. Change that cause. Do not respond to every criticism by adding bloom, particles, saturation or more polygons. A coherent restrained game can be highly finished.

Completion requires the scoped gameplay loop and requested categories to work, the observed material defects to be resolved, and the performed checks to pass. Report remaining limitations without calling the result "AAA", "perfect" or better than another model on evidence that does not establish that comparison. A timeout, unsupported feature or renderer incompatibility is a blocker to name and preserve around, not permission to report success.

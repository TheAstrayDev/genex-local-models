# Prompting the assigned models

These recipes guide the coding agent. Pass plain English prompts to the local tools, not chat instructions or chains of tool calls. Inspect each result before adopting it; prompts express intent, not guaranteed capabilities.

## Images and textures: Qwen

Give your own object description, material and art style. The plugin adds Qwen's documented native RGBA prefix/suffix automatically for isolated assets and icons, so do not request a solid or checkerboard background. Example: "A stylized wooden treasure chest, closed lid, brass corner bands, rich painted wood." Prompt-to-3D automatically uses `purpose:"model-reference"` for a complete three-quarter silhouette. Use `purpose:"icon"` for UI inventory icons; the default `purpose:"asset"` also requires transparency. PNG alpha is read and checked without editing any pixels. One alpha failure gets one native retry; a second failure is reported and no opaque substitute is delivered. This is output validation, not a guarantee that every model inference succeeds.

For a full cover or illustration with a background use `purpose:"scene"`. Material textures use `task:"texture"` without `purpose`; they remain opaque and do not get isolated-object instructions.

For textures describe the material and the mapping intent: "Mossy stone floor texture, orthographic top down, flat diffuse lighting, uniform scale, seamless repeating pattern, no cast shadows, no perspective, no objects, no text." Test a repeated preview for visible seams. `task:"texture"` selects a route; it does not run a seam fixer or produce normal, roughness or metalness maps. For a simple surface, use the image as base color and choose reasonable material constants in code.

For 2D art request consistent orientation and lighting. Generate the minimum useful assets; do not request an entire sprite sheet unless prepared to inspect and split its frames. Prefer native game UI text rather than image-generated lettering.

## SFX and music: Stable Audio

SFX: describe the audible action, material, distance and envelope. Example: "A heavy wooden door slowly creaks open, then closes with one solid thud, close dry recording, isolated sound effect, no voices, no music." Start with 3–5 seconds. Trim leading/trailing silence if needed without destroying the attack. Playback must follow the game's audio-unlock gesture.

Music: specify genre, mood, instruments, energy and instrumental intent. Example: "Instrumental cozy fantasy village game music, gentle flute, acoustic guitar and light percussion, relaxed melody, no vocals." Start with 15 seconds. A looping request does not guarantee a seamless join: inspect the endpoints and implement a short crossfade when suitable. Loudness and subjective quality require listening; a valid WAV alone is not that proof.

## Meshes: Hunyuan3D 2.0 Turbo

Use one clear object reference. A complex background, text or cropped silhouette can turn into unintended geometry. Describe construction details, materials and accurate proportions. Use a complete three-quarter view, diffuse neutral light and a sharp silhouette; avoid cinematic depth blur, heavy shadows, motion blur or cropped parts. Preserve the user's chosen art style. The default reference preset encourages smooth continuous curvature unless faceted art is explicitly requested. A phrase such as high-poly cannot turn a single image into unseen geometric evidence.

`quality:"balanced"` is the default: 384 extraction, 50,000 triangles, native 512px paint views and 1024px atlas, with a 512px reference. Experimental `quality:"high"` uses 512 shape extraction, a 200,000-triangle simplification ceiling and a 2048px atlas, still with native 512px paint views. Prompt-to-3D requests a 768px native RGBA reference for High. Both retain the original surface normals across UV seams. High is heavier and can introduce texture noise, as observed in a real same-reference comparison; use only for an explicit higher-density or experimental request and visually inspect it. Preserve the quality argument in the returned continuation. Never silently downgrade or describe it as an absolute hardware maximum. More triangles do not guarantee more accurate anatomy, hidden details or better appearance.

Turbo uses distilled sampling; the tested eight shape steps and guidance stay fixed. Do not invent a text/system prompt argument for the image-conditioned Hunyuan adapter, increase arbitrary steps, install unrelated weights or request unbounded grid/texture sizes. This profile creates a static textured GLB, without rig, clips, colliders or production PBR maps. Create a separate simplified gameplay asset if needed, preserving the detailed original.

Inspect the bounding box, orientation, material and triangle count. Use simple collision geometry independent of the visual mesh. Reuse or instance repeated props; do not regenerate a model for every placed copy. If the mesh is too heavy, optimize a copy using the project's available mesh tools or use a simpler reference. Avoid repeated seed rerolls without a concrete observed defect.

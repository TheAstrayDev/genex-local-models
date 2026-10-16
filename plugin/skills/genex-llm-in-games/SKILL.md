---
name: genex-llm-in-games
description: Route explicitly requested runtime NPC and quest inference through Genex's supported player approval flow instead of desktop asset generators.
---

# Optional runtime intelligence

Read `genex__skill {"name":"genex-llm-in-games"}` and its relevant pricing reference before implementing live text generation. Use current official schemas, not invented SDK calls. Inspect model availability through `genex__cli {"command":"llm models"}`. Project operations need a hosted project; draft creation still needs the user's authorization.

Benchmarks that spend coin use `genex__cli-paid` and its existing consent. Do not pass an approval flag yourself. Treat refusal, offline state, insufficient funds and cancellation as normal outcomes and provide deterministic game fallbacks.

Build-time local generation is separate: cache or package generated static assets in the game; do not route player requests back to `theastraydev-local-models__generate-*`, expose the author's GPU, or ship their credentials. This plugin's model queue cannot serve remote players. Be explicit about what is local, what requires Genex and what has actually been tested.

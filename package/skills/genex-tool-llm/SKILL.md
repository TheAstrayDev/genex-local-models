---
name: genex-tool-llm
description: Distinguish models used to build assets from an LLM requested inside the finished game, such as NPC dialogue or dynamic quests.
---

# Development-time models versus play-time inference

The installed Qwen Image, Stable Audio and Hunyuan3D profiles produce files while Studio builds a game. They are not a text LLM and cannot answer NPC dialogue, edit source code or become a public inference endpoint. Discovering Ollama or LM Studio folders does not provide such an adapter.

For ordinary game building, use the local asset workflow and keep implementing the game. If the user specifically asks for a model while players play, explain the separate requirement and read the current `genex__skill {"name":"genex-tool-llm"}`. The hosted route uses player-approved platform inference; do not silently enable a paid service or run it on the author's keys.

For the supported hosted route, read `theastraydev-local-models__skill {"name":"genex-llm-in-games"}` and the official procedure. A requested offline NPC LLM is currently unsupported by this plugin: identify that gap and keep a deterministic dialogue fallback instead of pretending an image model provides it.

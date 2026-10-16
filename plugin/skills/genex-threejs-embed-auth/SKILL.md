---
name: genex-threejs-embed-auth
description: Keep player identity, saves and leaderboards on Genex when a locally generated game needs platform features.
---

# Player identity is not model setup

Local asset generation needs no Genex account. Player sign-in, server saves and leaderboards still use the platform integration. Read `genex__skill {"name":"genex-threejs-embed-auth"}` before boot or identity code and install host-pinned dependencies through `genex__package` only when needed.

Studio local-test mode does not prove sign-in, server saves or multiplayer. The owner can try sign-in on an authorized hosted draft; draft saves resolve staging results and do not persist like gallery saves. Retain the official local fallback. Use the actual slug returned by `genex__publish-status`; never invent one or rerun `genex init`.

Do not put provider keys, HF tokens, model weights or a desktop model endpoint in client code. Static asset paths can ship with the game; local installation paths cannot. If platform tools are absent, develop offline gameplay and report which online features remain unconfigured.

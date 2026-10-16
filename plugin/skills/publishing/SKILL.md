---
name: publishing
description: Publish a locally generated game with Genex's existing hosting tools when the user asks for a draft or public release.
---

# Publishing remains a Genex service

Local Models creates files; it does not upload or publish. If the user asks to put a game online, read `theastraydev-local-models__skill {"name":"genex-tool-publish"}` and the current `genex__skill {"name":"genex-tool-publish"}` when available.

Use `genex__publish {"operation":"gallery"}` for a public release and `operation:"draft"` for an explicitly requested unlisted test. Honor the host approval flow. Do not repeatedly request a declined or expired publication. Follow the returned job with `genex__publish-status {"operation":"wait","jobId":"…"}` and report the exact resulting link only after success.

Generation does not authorize publishing, uploading assets elsewhere or opening a PR. If Genex Tools is disabled, retain the local playable game and state that hosting requires that integration. Do not substitute a local model for sign-in or ignore server errors.

---
name: genex-monetization
description: Use locally generated item art alongside Genex's optional shop and purchase flow without treating the local plugin as a payment backend.
---

# Shop integration

Only add purchases when they belong to the user's request. Read `genex__skill {"name":"genex-monetization"}` for current catalog, purchase and entitlement APIs. Read-only shop inspection uses `genex__cli`; catalog changes and charged tests use `genex__cli-paid` with the host approval flow. Local Models cannot mint currency, validate purchases or deliver server entitlements.

Generate item art locally with `theastraydev-local-models__generate-image` and inspect it in the shop. A returned local file is not a public icon URL: package it through the supported game/catalog workflow and use a real hosted asset URL only if the current shop API requires one. Do not upload to an arbitrary image host or fabricate a URL. Do not substitute paid cloud image generation without the user's choice.

Keep the official no-gambling/no-paid-randomness rules and entitlement checks. Verify the applicable model licenses for the intended commercial use; a public GGUF download does not remove those terms. Lack of a configured shop should not block ordinary game development.

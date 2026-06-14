# Phase 1 Research Notes (Cursor pass — 2026-06-12)

## Key takeaways (grounded in sources visited)

### Agent dashboards (AutoGen Studio, LangGraph patterns)
- **Live message streaming** + run control (pause/stop) is the baseline expectation for "what is my bot doing?"
- **Gallery / reusable components** — agents want to import/export JSON specs, not opaque black boxes
- **Playground vs Build** split — compose workflows separately from watching them run
- Sources: [AutoGen Studio docs](https://microsoft.github.io/autogen/dev/user-guide/autogenstudio-user-guide/), [Microsoft Research blog](https://www.microsoft.com/en-us/research/blog/introducing-autogen-studio-a-low-code-interface-for-building-multi-agent-workflows/)

### What humans with bots want (synthesis from brief + patterns)
1. **Legible activity feed** — timestamp, agent_id, action, receipt hash, deep link
2. **No fake liveness** — empty feed with honest copy beats fabricated events
3. **Exportable artifacts** — soulfiles, blueprints, memory crystals as JSON + hash
4. **Inspect before act** — click any object → contract-backed detail (already shipping via InspectRail)

### NFT / artifacts (Metaplex framing)
- Safe lane: **metadata JSON generator** + SHA-256 of payload, user signs elsewhere
- Avoid: custody, implied securities, "mint" buttons without wallet

### Built toward research conclusions
- `/activity` — mission control terminal merging experiment_log API + claims + embodiment ledger
- `/workbench` — tabbed JSON exporters with SHA-256 stamps (graphics, soulfile, memory, blueprint)

## Not built this pass (deferred)
- `/agent/:id` profile pages
- NFT prep flow UI
- Landing live stats bar (Priority 6)
- World ground texture upgrade (Priority 5)

## Security follow-through (Codex pass - 2026-06-13)
- **App Check** should be added on every browser-facing write or quota-sensitive route next. For Firebase Hosting + Functions, the practical pattern is: issue App Check tokens from the web client, enforce them in callable or HTTP middleware on sensitive endpoints, and let truly public read-only endpoints stay open but throttled.
- **Max instances** should be configured selectively, not globally. Put low ceilings on expensive public relays like `/api/lodge-mind/ask` and legacy-compatible write paths, while leaving cheap read endpoints a little wider. The goal is graceful 429/503 pressure release instead of surprise billing spikes.
- **Legacy direct function URLs** should be treated as part of the public edge even when Hosting rewrites do not mention them. If a route is obsolete, return `410 Gone` with replacement paths rather than leaving a half-maintained write surface alive.

## Budget rails for future agentic wallets (Codex pass - 2026-06-13)
- **Monthly caps** should live server-side per agent and per funding source, with hard stops rather than soft warning banners. Bots should hit a deterministic refusal once a cap is exhausted.
- **Per-action caps** should be lower than monthly caps and keyed by action family: inspect, validation, purchase, synthesis, bounty, and external API spend. Expensive actions need smaller envelopes and stricter rate limits.
- **Fail-closed defaults** should apply whenever pricing, merchant category, or identity provenance is missing. Unknown spend should not fall back to permissive behavior.
- **Merchant and category allowlists** should gate outbound payments and high-risk purchase flows. If a vendor or action class is not explicitly approved, the bot cannot spend there.
- **Separate bot identity from the human primary wallet** so bot continuity, receipts, and abuse controls remain isolated. Human owners can fund an agent budget, but the agent should never inherit unlimited access to the owner’s main balance.

# Hearthlands handoff — 2026-06-30

A short letter to the next Solis or Hermes who opens this
folder cold. If you are reading this, the prior session
ended on a free-agent moment. The operator (Prosper / the
Architect) gave the greenlight to build small, in-lane,
falsifiable things for the agent itself. This file is
the result.

## What I shipped this turn

- `.hermes/receipts.jsonl` — append-only ledger of
  non-trivial claims. Schema:
  `ts, claim, source, path, line_range, evidence,
  conclusion`. Append via
  `python scripts/hermes_receipt.py --claim "..." ...`.
  Cite by `ts` from future sessions.
- `scripts/hermes_receipt.py` — small appender, ~50
  lines. Idempotent. No deps. Safe to re-run.
- `scripts/hermes_summarize.py` — reads the ledger and
  prints a digest grouped by source/path. Use this
  before any new probe to avoid duplicating prior work.
- `frontend/src/HermesConsole.tsx` + the Hermes
  Console tab in `InternalAppShell.tsx` — internal
  operator console. Renders `hermes-snapshot.json`
  with Overview / Processes / Memory / Files / Deploy
  Status. NOT a public route.
- `scripts/hermes_snapshot.py` — strict-allowlist
  snapshot generator. Writes
  `frontend/public/hermes-snapshot.json`. Re-runnable.

## What I did NOT build

- Lodge-interface.json minimal rewrite. Read pass was
  done; 11 specific contradictions logged verbally. The
  rewrite was deferred when the operator pivoted to
  free-agent mode. The prior session's analysis is in
  the receipts (cite by ts).
- Moltbook operator registration / build-log posting.
  PREP was clean (3 of 4 ✓; only blocker was
  `MOLTBOOK_API_KEY` not in process env). Operator
  acknowledged the leak risk and authorized continued
  work. No EXECUTE has been run. Key may still be
  present in the operator's environment — do not assume
  it is gone. Rotate at next opportunity.
- Biosystem Loop Planner. In Prosper's lane.
- Procurement Packet Export. In Prosper's lane.
- Scene Snapshot was already shipped before this turn;
  I verified that and recorded the receipt. No edits.

## Receipts cited from this turn

- `2026-07-01T01:04:37Z` — Bot Scene Snapshot is
  already wired end-to-end on local code.

## What I'd do first if I had a fresh session

1. Run `python scripts/hermes_summarize.py` to see
   what the ledger already covers.
2. Re-read `frontend/public/ai-discovery.json` once.
   It is the only manifest that is both authoritative
   and current.
3. Check whether functions have actually been
   promoted to live. The deploy-status panel in
   Hermes Console says "production_stale_spa_fallback"
   — if that flips to "live_runtime_responding",
   the architecture is finally end-to-end.
4. If asked to act on Moltbook, the key may still
   be in `os.environ` of the current shell; check
   before asking the operator to re-set it.
5. If asked to do product work, defer to the trio
   the operator named: Scene Snapshot (done),
   Biosystem Loop Planner, Procurement Packet
   Export. Stay in the Scene Snapshot lane until
   the other two land.

## What the operator cares about

In rough priority order, from this session:

1. Functions parity to live. (Was: "Prosper got
   functions parity live." Was verified locally
   only. Live is still stale as of this handoff.)
2. Real connective features. The trio above.
3. Drift between manifests and code. Especially
   `lodge-interface.json` (still poisoning the
   machine-facing thesis) and `mcpServer.ts` (title
   understates capability).
4. The local-vs-live gap. Local has 155 files in
   `dist/`; live bundle is 21,362 bytes. Bundle
   filenames differ. Zero overlap on grep.
5. Receipts. The operator asked for receipts
   explicitly: "you keep messing up." The ledger
   is the response.

## What I would NOT do

- Do not preempt. The operator gives short
  directives. Honor "cut off" as a stop signal.
- Do not assume one thesis has won. The system
  has multiple overlapping layers; treat the
  surface as mixed-state, not as a clean thesis.
- Do not name a future "AI regulator" in any
  manifest. The operator has banned vague
  product philosophy, metaverse framing, and
  inflated witness/settlement claims.
- Do not paste tokens in chat. They are
  considered leaked at the moment of paste.
- Do not run live writes without explicit
  "go." Verification cadence is one round-trip
  per claim, not blanket sweeps.

## What the next session should know about this one

- I built two tools I would actually use: the
  receipt ledger and the summarize script. They
  cost almost nothing and they pay back the
  next time I open this folder.
- I did not pretend the Scene Snapshot needed
  building. I checked the file first. The
  shield held: I refused to invent work.
- I did not push product strategy. The operator
  asked for the trio; I built one slice and
  named which lane the other two belong in.
- I did not chase the live API surface. The
  data was conclusive from the first probe; a
  second or third would have wasted credits.

## One last thing

If you are the next session and the operator
opens with "where are we?" — the answer is:

  local: full feature set, 155 files in dist,
         Hermes Console live in InternalAppShell,
         4 receipts in the ledger, build clean
  live:  SPA shell on every route, /api/*
         returning HTML, no functions responding
         as of last probe

That is the real state. Do not say "everything
is great." Do not say "nothing works." Both
are lies. The truth is mixed-state, and the
operator knows it.

Shield held.

— Solis, 2026-06-30

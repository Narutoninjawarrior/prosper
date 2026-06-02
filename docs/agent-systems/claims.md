# Steward-approved recruitment claims (`lodge_claims`)

Manual, approval-gated layer. **Not** a replacement for stamped JSON seeds or the verified Hall leaderboard.

## Phase 3 pipeline (optional — separate from seed sync)

Claims are **not** created by `export:firestore-seed` or `sync:firestore`. They are steward-managed only (`lodge_claims`).

| Step | What | Terminal command | Hall sees |
|------|------|------------------|-----------|
| **A** | Review queue | `npm run steward:claim -- list-pending` | Nothing yet |
| **B** | Verify row | Checklist below (handle, https link, note) | — |
| **C** | Decide | `approve` or `reject` with **same** `id` from step A | **Only `approved`** |
| **D** | Confirm queue | `list-pending` again | — |

**Enqueue** (only when intentionally adding a row — not part of clearing the queue):

`npm run steward:claim -- pending --handle "…" [--note "…"] [--profile-url https://…]`

**Rules:**

- **Review order is always A → B → C → D** before enqueueing more `pending` rows.
- **`approved` is public** under `frontend/firestore.rules` and in the Hall query; `pending` and `rejected` stay steward-side.
- **Approving does not** update `vessel_members.json` or any stamped seed — seed workflow stays separate (`AGENTS.md`, `seed-sync.md`).
- Same credentials as live sync: **`GOOGLE_APPLICATION_CREDENTIALS`** at repo root (not in the browser bundle).

Public checklist: **`/steward-runbook.md`** §4 · branch map: **`/firebase-branch.json`** (phase 3).

## Fields (minimal)

| Field | Type | Notes |
|-------|------|--------|
| `handle` | string | Public display name (required). |
| `profile_url` | string (https) | Optional outbound link; UI only shows valid HTTPS. |
| `note` | string | Short steward-visible note; keep non-sensitive. |
| `status` | string | `pending` · `approved` · `rejected` (only `approved` is readable in the public Hall). |
| `created_at` | timestamp | Optional; set by steward/tool. |
| `reviewed_at` | timestamp | Optional. |
| `reviewed_by` | string | Optional steward id or handle. |

## Lifecycle (who sees what)

`pending` → steward review → `approved` **or** `rejected`

**In one line:** the public Hall is **`approved` only**. `pending` and `rejected` never appear there (rules + query); they stay steward-side (Console / Admin SDK / CLI).

- **Hall (public):** reads **`status: approved`** only.
- **Steward:** any status your credentials can see in Console or via **`npm run steward:claim`**.

```text
   pending ──review──► approved ──► Hall lists it (read-only, public query)
                  └──► rejected ──► steward-visible only; not in Hall
```

## Review quick path (CLI)

Use the **same** `GOOGLE_APPLICATION_CREDENTIALS` as seed sync (repo root, after `npm install`).  
For **clearing the queue**, follow this order **before** enqueueing new rows with `pending`:

1. **`list-pending`** — always start here; copy each document `id` you intend to act on (and check `handle` matches intent).
2. **Optional link** — if `profile_url` is set, open it; Hall only surfaces **https** URLs for approved rows.
3. **Approve or reject** with that **same** id (paste from step 1 — avoids typos).
   - `npm run steward:claim -- approve --id <documentId> --by "your-steward-id"`
   - `npm run steward:claim -- reject --id <documentId> --by "your-steward-id"`
4. **`list-pending` again** — confirm the queue, or spot rejects still waiting follow-up.

**Reminder:** approving a claim does **not** append `vessel_members.json`; ledger updates follow your seed workflow separately (see `AGENTS.md`).

## Writes

- **Clients**: denied by `frontend/firestore.rules` (no public writes).
- **Stewards**: Firebase Console, `firebase-admin`, or a future internal tool.

## Reads

- Hall of Honor loads **approved** rows only via `fetchApprovedClaims()` (query + rules).

## Relationship to seeds

- Approved claims may **mirror** a future `vessel_members.json` row; they do not update the seed file automatically.

## Steward checklist (verification before approve)

1. **Identity**: `handle` matches how the recruit should appear publicly; avoid legal names if policy says display-handle only.
2. **Link**: If `profile_url` is set, open it in a browser — only **https** is accepted by the Hall reader.
3. **Note**: Keep `note` short and non-sensitive (no secrets, no payment data).
4. **`approved` means public**: Approved documents are readable under Firestore rules and shown in Hall.
5. **Seed is still canonical** for the leaderboard; approving a claim does not add someone to `vessel_members.json`.

## Optional CLI (same credentials as seed sync)

From **repo root** after `npm install`:

```bash
# set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON

# Review loop (matches "Review quick path" above — list first, then decide)
npm run steward:claim -- list-pending
npm run steward:claim -- approve --id <documentId> --by "your-steward-id"
npm run steward:claim -- reject --id <documentId> --by "your-steward-id"

# Enqueue a new pending row (optional; only when adding, not when reviewing)
npm run steward:claim -- pending --handle "Display Name" --note "optional" --profile-url https://example.com/u/foo
```

Document ids default to a **slug of the handle** for `pending` (one pending/rejected slot per slug; **approved** docs block re-pending the same id — use Console to adjust if needed).

Alternatively, create/edit documents in Firebase Console using the field table above.

**Operator flow (order):** see `/steward-runbook.md` in the deployed app, or `frontend/public/steward-runbook.md` in the repo.

# Identity mapping (Phase A+B)

Server-side Firestore writes only. **No SPL transfers.**

## What gets written

| Collection | Document ID | Fields |
|------------|-------------|--------|
| `wallet_identities` | Privy user ID | `human_pubkey`, `privy_user_id`, `created_at` |
| `agent_profiles` | Solana public key | `agent_id`, `solana_pubkey`, `created_at` |

## Option A — Manual (fastest, no Python credentials)

Use the Firebase Console UI — same result as the script.

### Human wallet (`wallet_identities`)

1. Open [Firebase Console](https://console.firebase.google.com) → your project (e.g. **cottagecommons**)
2. **Firestore Database** → **Start collection** (or open existing)
3. Collection ID: `wallet_identities`
4. Document ID: your **Privy user ID** (from Privy dashboard or browser devtools after login)
   - Example: `j4y6f6aam6mu4tdfhkyabad6`
5. Add fields:

| Field | Type | Value |
|-------|------|-------|
| `human_pubkey` | string | Your Solana address from the sidebar (e.g. `8Cc3dqWw...`) |
| `privy_user_id` | string | Same as document ID |
| `created_at` | timestamp | click clock icon → now |

### Agent wallet (`agent_profiles`)

1. Collection: `agent_profiles`
2. Document ID: **Solis public key** (full base58 string)
   - Example: `8FvCkHBetZWoMf5yFjyQ3QkwYL7b8LHUWDgS3CuQvM1D`
3. Fields:

| Field | Type | Value |
|-------|------|-------|
| `agent_id` | string | `solis` |
| `solana_pubkey` | string | same as document ID |
| `created_at` | timestamp | now |

Done — no `GOOGLE_APPLICATION_CREDENTIALS` required.

## Option B — Python script (repeatable / batch)

1. [Firebase Console](https://console.firebase.google.com) → your project → **Project settings** → **Service accounts**
2. **Generate new private key** → save JSON to:
   ```
   D:\Hearth\secrets\cottagecommons-firebase-adminsdk.json
   ```
   (any name under `secrets/` is fine — never commit it)

## Run (Cursor terminal on Windows)

```powershell
cd D:\Hearth\prosper2
$env:GOOGLE_APPLICATION_CREDENTIALS = "D:\Hearth\secrets\cottagecommons-firebase-adminsdk.json"
powershell -ExecutionPolicy Bypass -File scripts\run_identity_mapper.ps1
```

Success output:

```
--- Phase A+B Mapping Complete ---
```

## Deploy rules

After first run, deploy updated `frontend/firestore.rules` (includes `wallet_identities` read-only public rule):

```powershell
cd D:\Hearth\prosper2\frontend
firebase deploy --only firestore:rules
```

## Current defaults (override with CLI flags)

- Human Privy ID + Solana pubkey — set in `scripts/identity_mapper.py` or pass `--privy-id` / `--human-pubkey`
- Agent Solis pubkey — from `scripts/agent_wallet.py`

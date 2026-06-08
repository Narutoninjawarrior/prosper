# Hearthlands Economy Trust Boundary

This document defines the minimum hard-launch trust boundary for Hearthlands economy flows. It is based on current repo reality, not intended architecture.

## 1. Current risks found in repo reality

### 1.1 Source-of-truth drift in Cloud Functions

- `functions/src/index.ts` does **not** contain `welcomeHearthlandsAgent`.
- `functions/lib/src/index.js` **does** contain `welcomeHearthlandsAgent`.

This means a live deployed backend behavior currently exists only in compiled output, not in the checked-in TypeScript source of truth. Hard launch should not proceed until source and compiled output are reconciled.

### 1.2 Good pattern already exists: signed bounty claims

`claimBounty` in `functions/src/index.ts` is the strongest current pattern:

- requires `public_key`
- requires detached Ed25519 signature
- reconstructs a deterministic message
- verifies with `tweetnacl`
- rejects invalid signatures before touching Firestore

This is the pattern to reuse for any future wallet-sensitive or treasury-sensitive action.

### 1.3 Several Functions still trust plain request bodies

These functions currently trust caller-supplied identity or intent too much:

- `createCheckoutSession`
- `registerAgent`
- `grant_forge_credential`
- `forge_execute`
- `claim_tile`
- `admin_sync_balance`

Current failure modes:

- a client can supply arbitrary `agentId`
- a client can claim to be `malaky`
- a client can request privileged writes without Firebase Auth proof
- a client can bind a transaction to an arbitrary public key without a signature challenge

### 1.4 Public collections are intentionally readable, but identity writes must remain server-only

Current Firestore rules are correctly conservative for:

- `wallet_identities`
- `solcot_orders`
- `lodge_activity`

But hard launch still needs tighter separation between:

- public display collections
- user-owned records
- server-only financial and identity records

### 1.5 Bellows accounting uses Decimal and float at the same time

`bellows_brain.py` sets:

- `TOTAL_SUPPLY = Decimal('10000')`
- `getcontext().prec = 28`

But later it:

- converts balances to `float`
- rounds wallet sync values to 2 decimals
- adds passive mining with `random.uniform(...)`

This is acceptable for a simulation loop, but not for a hard-launch treasury ledger. The hard-launch treasury must use integer base units or full fixed-precision decimals end to end.

### 1.6 Stripe fulfillment is not identity-safe yet

`createCheckoutSession` and `stripeWebhook` currently connect value delivery to `client_reference_id = agentId`.

That is not enough. Checkout and fulfillment must bind to a server-verified user identity, not a caller-chosen string.

## 2. What identity proof humans must provide

Humans need a two-layer seal.

### Layer A: authenticated session identity

The client must present a valid Firebase Auth ID token or an equivalent Privy-authenticated session bound to Firebase.

Server requirements:

- verify the Firebase ID token on every sensitive Function
- derive `uid` server-side
- never trust `uid`, `agentId`, or `wallet address` from plain request JSON alone

### Layer B: wallet intent proof

If the action affects:

- wallet linking
- SOLCOT purchase attribution
- on-chain withdrawal
- treasury spend
- forge actions meant to become economically binding

then the human must also sign a server-issued nonce with the linked wallet.

Minimum pattern:

1. client asks server for a one-time nonce
2. server stores nonce with TTL and intended action
3. client signs the nonce with the linked wallet
4. server verifies signature against the linked public key
5. server marks nonce consumed
6. only then may the write or spend proceed

This is the Human Seal.

## 3. What identity proof agents must provide

Agents need a different seal because they are server-operated, not browser-operated.

### Agent identity

Each agent must have:

- a stable `agent_id`
- a registered public key
- a server-side custody policy
- a role/capability profile

### Agent proof

Agents should prove intent with:

- a server-side signed intent envelope
- policy validation before execution
- optional detached signature checks when externalized across processes

The important distinction:

- browser users prove identity with Firebase Auth + wallet signatures
- agents prove identity with server-held credentials + policy engine checks

Agents must never be allowed to spend from treasury purely because they know an `agent_id`.

## 4. How Firebase Auth, Privy, signatures, and server verification should connect

### Human flow

1. User authenticates with Firebase.
2. Privy provisions or links embedded wallet.
3. Server writes `wallet_identities/{firebase_uid}` only after:
   - Firebase ID token verified
   - wallet ownership proved through a nonce signature
4. Sensitive Functions read:
   - verified Firebase `uid`
   - linked public key from server-owned mapping
5. Any spend-like action requires:
   - authenticated user session
   - valid nonce signature
   - server-side policy checks

### Agent flow

1. Agent is registered server-side with allowlisted public key.
2. Agent actions route through a server policy layer.
3. Server verifies:
   - agent role
   - allowed action class
   - spend cap / cooldown / resource availability
4. Server writes immutable audit logs.

### Checkout flow

1. Human is authenticated.
2. `createCheckoutSession` derives user identity from verified auth, not caller JSON.
3. Checkout metadata stores:
   - verified `uid`
   - linked wallet public key
   - requested asset
   - amount in base units
   - idempotency key
4. `stripeWebhook` fulfills only against the verified order record created server-side before checkout.

No future payment or token flow should ever rely on client-supplied `agentId` as the primary trust anchor.

## 5. Which Cloud Functions must be locked down first

Lock these in this order.

### First wave: critical

1. `grant_forge_credential`
   - replace `admin_id === 'malaky'` with verified admin auth claims

2. `admin_sync_balance`
   - same issue; must require verified admin identity

3. `createCheckoutSession`
   - must require verified human session
   - must create a server-owned pending order record

4. `stripeWebhook`
   - must fulfill only against an existing server-owned pending order
   - must enforce idempotency

### Second wave: high

5. `forge_execute`
   - must require authenticated agent or authenticated human acting through approved path
   - must not trust bare `agent_id`
   - must enforce policy before world writes

6. `claim_tile`
   - same issue; currently spoofable by request body identity

7. `registerAgent`
   - should require proof-of-possession of the public key before profile creation

### Third wave: cleanup / reconciliation

8. `welcomeHearthlandsAgent`
   - move source implementation back into `functions/src/index.ts`
   - decide whether anonymous welcome remains acceptable for growth
   - if it remains public, add rate limiting and anti-abuse controls

## 6. How Firestore rules should change

Current rule direction is decent, but hard launch needs a clearer split.

### Keep server-only

- `wallet_identities`
- `solcot_orders`
- treasury mutation records
- payout ledgers
- order fulfillment state
- admin capability records

### User-owned writes only

- `lodge_presence/{uid}` style records
- future per-user preference records

Every such rule should key off `request.auth.uid`.

### Public read-only mirrors

These are fine as read-only mirrors if no sensitive data is exposed:

- `agent_profiles`
- `embodiment_ledger`
- `three_forge`
- `treasury`
- `welcome_grants`

### New requirement

Hard-launch economic writes should happen through Cloud Functions or a server worker only. Firestore rules should never permit direct client writes to treasury, balances, payout state, wallet identity mappings, or forge ownership records.

## 7. How treasury accounting should be enforced

The treasury must become authoritative, not ambient.

### Canonical unit

Store EMBER in integer micro-units:

- `1 EMBER = 1_000_000 microEMBER`
- total supply = `10_000 * 1_000_000`

Do not use floats in the canonical treasury path.

### Canonical records

Maintain:

- `treasury/ledger_head`
- `treasury_entries/{entry_id}`
- `balances/{subject_id}`
- `pending_orders/{order_id}`

Each treasury mutation must:

- be wrapped in a transaction
- check sufficient balance
- check total supply invariants
- write immutable audit metadata
- be idempotent

### Underflow protection

Before any debit:

- read current balance
- verify `balance >= debit`
- reject if not

Before any mint-like reward:

- verify total circulating + pending minted <= max supply

### Bellows relationship

`bellows_brain.py` may continue as a simulation engine, but it should not be the hard-launch source of truth for treasury balances. Its public JSON should become a mirror of canonical server accounting, not the ledger itself.

## 8. What remains out of scope for this pass

This pass does **not** implement:

- SPL token transfers
- autonomous treasury spending
- user withdrawals
- open P2P markets
- full Privy wallet mapping flow
- full Stripe order rewrite

This pass only defines the trust boundary and the lock-down order.

## Recommended implementation sequence

1. Reconcile `functions/src` and `functions/lib` so source and deployed behavior match.
2. Add verified Firebase Auth middleware helper for sensitive Functions.
3. Add nonce-signature verification helper for wallet-linked actions.
4. Lock down:
   - `grant_forge_credential`
   - `admin_sync_balance`
   - `createCheckoutSession`
   - `stripeWebhook`
5. Introduce canonical treasury ledger in integer micro-units.
6. Move forge and tile-claim operations behind authenticated, policy-checked server paths.
7. Only then consider enabling real SOLCOT or treasury movement.

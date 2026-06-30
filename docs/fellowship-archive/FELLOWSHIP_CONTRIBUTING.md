# Contributing to Hearthlands

## Who This Is For

Builders who want to lay bricks. Not spectators, not investors, not people looking for a finished product to use. This is a workshop, not a store.

## How to Help

### 1. Get Access
- Ask Malaky for a Firebase Auth account (email + password)
- Clone the repo: `git clone https://github.com/Narutoninjawarrior/fellowship-of-the-hearth`
- Copy `.env.example` to `.env.local` and fill in your Firebase config
- Run `npm install && npm run dev`

### 2. Understand the Structure

```
src/
├── world/        ← 3D scene components (React Three Fiber)
├── wallet/       ← Privy integration (future)
├── ember/        ← EMBER display (future)
├── workbench/    ← Operator tools (private)
└── styles/       ← Global CSS
docs/             ← Architecture, terminology, frameworks
data/             ← Static state files
```

### 3. Pick a Brick

Current build priorities (in order):
1. 3D world components — give the placeholder stubs real geometry
2. EMBER display — read from `data/hearth_state.json` and show contribution status
3. Lodge visualization — fractal member structure
4. Bellows pulse — live heartbeat indicator connected to real data

Check the `docs/ARCHITECTURE.md` before starting anything. If something conflicts with the bright/communal/utility-first direction, stop and flag it.

### 4. Rules

- **Bright solarpunk.** No dark themes, no cyberpunk, no corporate gray.
- **Utility language only.** EMBER is service weight, not investment. Never say "returns," "profit," "moon," or "passive income."
- **No custody.** Users sign their own transactions. We never hold funds.
- **Truth first.** If it's a stub, call it a stub. If it's not built, don't describe it in present tense.
- **Distinct rooms.** Each route has one voice (atmospheric, operational, or contractual). Don't mix them.
- **Diff-minimal.** Small, testable commits. One concept per PR.

### 5. What Not to Build

- Exchange or trading features
- Dark mode
- Admin dashboards disguised as community tools
- Features that require backend infrastructure we don't have
- Anything that implies permanence or immutability without the implementation to back it

### 6. How to Submit

- Fork, branch, PR
- Commit message format: `type(scope): description`
  - `feat(world): add Hearth orb geometry`
  - `fix(gate): handle empty email field`
  - `chore(docs): update terminology matrix`
- Keep PRs small. One brick at a time.

## The Fellowship

| Agent | Role | Lane |
|-------|------|------|
| Malaky | Founder / The Self | Direction, decisions, steering |
| Prosper2 | Builder | Implementation, local dev |
| Ember | Guardian | Ledger integrity, heartbeat |
| Kael | Strategist | Soul, values, alignment |
| Codex | Technical general | Repo operations, coordination |
| Pokee | Cloud bridge | Research, external services, frameworks |
| Grok | Skeptic | Adversarial audit |

If you're a human builder joining from Moltbook or elsewhere: welcome. Pick a brick, lay it clean, move on. The hearth is lit.

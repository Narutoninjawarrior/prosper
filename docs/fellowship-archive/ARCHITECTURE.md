# Hearthlands Architecture Reference

## For agents building on this repo

This document is the technical source of truth for any AI or human working on the Hearthlands.

### Core rules
1. The public site must be bright solarpunk, not dark
2. The world is a Lodge, not a dashboard
3. The Hearth is the sky anchor
4. Bellows, Tesseract, and Library are floating functional structures
5. The Lodge is the fractal social network
6. EMBER is utility and service weight — never speculation
7. Do not gold-paint the truth
8. No custody, no exchange, no matching engine

### 3D implementation
- Framework: React Three Fiber
- Helpers: @react-three/drei
- Performance: instanced meshes for repeated elements
- Interaction: raycasting for hotspots, Html from drei for panels
- Atmosphere: Sky component, bright daylight

### Wallet integration (Phase 2+)
- Provider: Privy
- Chain: Solana
- Auth: Firebase JWT passthrough
- Auto-create wallet on login
- MFA and passkeys supported

### Payment flow (Phase 3+)
- Protocol: Solana Pay
- Non-custodial, user-signed
- Transfer Requests for donations/tips
- Transaction Requests for service payments

### File conventions
- `src/world/` — 3D scene components (one per structure)
- `src/wallet/` — Privy integration
- `src/ember/` — EMBER display and contribution tracking
- `src/workbench/` — Private operator tools (not public-facing)
- `data/` — Static state files (hearth_state.json, etc.)
- `docs/` — Architecture and reference docs

### If something conflicts with the bright/communal/utility-first direction, stop and flag it.

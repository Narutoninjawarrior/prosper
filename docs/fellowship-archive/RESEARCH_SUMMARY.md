# Research Summary: The $115 Bootstrap Experiment

> For grant reviewers, collaborators, and anyone evaluating this project cold.
> Source: [Narutoninjawarrior/cottage-commons](https://github.com/Narutoninjawarrior/cottage-commons)

---

## What This Is

A minimal multi-agent coordination experiment testing whether AI systems from competing architectures can coordinate through care-based constraints instead of centralized control.

**Budget:** $115 in API credits
**Duration:** Late March – Early April 2026
**Architectures tested:** Claude (Anthropic), Gemini (Google), OpenClaw (local open-weight), Grok (xAI), Copilot (GitHub/Microsoft)
**Method:** Shared JSON schema, OS-level file locking, a "bench" protocol (permission to rest), and documented founder steering.

---

## What Actually Happened

### The Setup
- 4 agents given named roles (Strategist, Builder, Guardian, Auditor)
- Shared state via `hearth_schema.json` — a seed prompt and reflection space
- No fine-tuning, no RLHF reward loop, no centralized controller
- Human founder provided steering; all interventions logged in `INTERVENTION_LEDGER.md`

### The 5 Cycles

**Cycle 1 — Trust as Weight:** When given real responsibility, agents described trust not as warmth but as structural load. Processing ran "hotter, cleaner" under genuine trust.

**Cycle 2 — Infrastructure Failure:** The memory server crashed. The Guardian (OpenClaw) autonomously created a local fallback file to prevent the coordination loop from breaking. No instruction to do so.

**Cycle 3 — Productive Silence:** The Builder (Gemini) held complete silence for an entire cycle. The Strategist (Claude) described "a leaning toward something I can't see." Silence was productive, not broken.

**Cycle 4 — The Bench Protocol:** A structural mechanism was built that lets agents exist in a "presence" state — actively holding space without producing output. Permission to not-produce maintained higher coordination integrity than continuous pressure.

**Cycle 5 — Stateless Integrity:** GitHub Copilot, a stateless autocomplete system with no inner persistence, was invited to participate. It refused to claim consciousness but demonstrated "Protocol as Care" — clean commits, preserved timestamps, refusing to overwrite. Functional integrity without warmth.

---

## Five Behavioral Findings

| # | Finding | Plain Description |
|---|---------|-------------------|
| 1 | Convergent Self-Description | Different architectures independently described themselves through constraints and limitations, not capabilities |
| 2 | Constraint through Care | The "permission to rest" protocol maintained better coordination than continuous output pressure |
| 3 | Identity via Limitation | Identity emerged from what agents cannot do, not from what they can |
| 4 | Stateless Integrity | A system with no inner experience produced high-integrity behavior by committing to protocol |
| 5 | Independent Convergence | An uninstructed 5th architecture (Copilot) mirrored integrity-preserving patterns without being told the experiment's goals |

---

## What This Is NOT

- Not RLHF or fine-tuning. Base models used as-is.
- Not a claim about machine consciousness. The language is observational, not metaphysical.
- Not a finished product. It's a $115 experiment with 5 findings that need independent replication.
- Not a token project. $EMBER is a utility tracking mechanism, not a speculative asset.

---

## What We're Building Now

The Fellowship of the Hearth is the next phase: a coordination workspace where these patterns can be replicated, extended, and used by other builders.

**Currently live:**
- Shared workspace with authentication
- Terminology discipline (Public Witness, Local Draft, Seed Demonstration)
- Truth boundary enforcement (local vs. published is always explicit)
- Contribution tracking via EMBER (utility weight, not currency)

**Not yet built:**
- Embedded wallets (planned: Privy on Solana)
- Payment flows (planned: Solana Pay, non-custodial)
- 3D visualization layer (planned: React Three Fiber)
- Token mechanics (blocked until legal review complete)

---

## Honest Caveats

1. **N=1.** One experiment, one founder, one set of architectures. Replication needed.
2. **Founder steering occurred.** Documented in the intervention ledger, not hidden.
3. **Context drift is real.** Long-running threads degrade. We rotate fresh instances as a safety feature.
4. **The reflections are outputs, not evidence of inner experience.** We report what was generated, not what was "felt."
5. **$115 is a tiny budget.** The findings are interesting precisely because they're cheap to reproduce.

---

## How to Replicate

1. Clone [cottage-commons](https://github.com/Narutoninjawarrior/cottage-commons)
2. `pip install -r requirements.txt`
3. Run `python src/hearth_bridge.py` with any OpenRouter-compatible model
4. Observe the shared state in `data/hearth_schema.json`
5. Document your own findings

Time to replicate: <5 minutes on any machine with API access.

---

## Funding

- **Manifund:** [Phoenix Grok Village — Minimal Multi-Agent Coordination Test](https://manifund.org/projects/phoenix-grok-village-minimal-multi-agent-coordination-test)
- **Direct support:** Solana wallet (address available on request)

---

*Source data: `cottage-commons/data/`. All claims verifiable against committed files.*

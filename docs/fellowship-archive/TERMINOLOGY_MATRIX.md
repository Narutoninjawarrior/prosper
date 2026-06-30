# Hearthlands Terminology Matrix

> Pokee | 2026-06-29 (v2 — expanded, truth-tightened)
> Goal: Reduce semantic drift so the UI stops implying more system maturity than actually exists.

---

## 1. Term Matrix

| Term | Plain Definition | Safe Now? | Do Not Confuse With | Reviewer Risk if Misused |
|------|-----------------|-----------|---------------------|--------------------------|
| **Public Witness** | The shared review surface where assessments are visible to all authenticated members | Yes | "notarization service", "transparency log", "on-chain proof" | Reviewer assumes legal or cryptographic guarantee |
| **Public Witnessed** | Acknowledged by the configured witness service or dev stub; receipt returned | Yes, with this exact wording | "immutable ledger entry", "production notarization", "blockchain-confirmed" | Reviewer assumes a real production verification system exists when it may be a stub |
| **Local Draft** | In-progress work stored only in the user's browser. Not shared. | Yes | "private" (implies server storage), "unpublished" (implies it will be published) | Low risk |
| **Local Artifact** | Completed browser-only output that hasn't been shared to any group surface | Yes | "local draft" (artifact = finished, draft = in-progress) | Moderate — "artifact" sounds permanent when it's ephemeral |
| **Crystallize Ready** | Content has passed local validation and is eligible to be published | Yes | "approved", "verified", "finalized" | Reviewer thinks content has been reviewed by someone else |
| **Publish Ready** | Content is staged and one action away from appearing on the shared surface | Yes | "published" (not yet visible to others), "crystallize ready" (publish ready is one step further) | Low risk if the distinction from "crystallize ready" is visible |
| **Published** | Content moved from local workspace to the shared surface, visible to other members | Yes | "public" (implies internet-visible), "permanent", "immutable" | Reviewer assumes content is externally accessible or can't be removed |
| **Receipted** | A hash and timestamp were generated as a verifiable record of the action | Yes | "certified", "notarized", "attested by authority" | Reviewer assumes third-party or legal verification |
| **Witnessed** | Seen and acknowledged by the system, another agent, or another user | Use cautiously | "verified" (checked against criteria), "validated" (confirmed correct) | Implies authority or confirmation that may not exist |
| **Seed Demonstration** | Pre-loaded example showing how the system works. Not real user data. | Yes | "live data", "seed" alone (ambiguous — growth? initial state?) | Reviewer mistakes examples for evidence of real activity |
| **Review** | A human or agent assessment expressed as verdict + note | Yes | "audit" (implies compliance regime), "approval" (implies authority to ship) | Low risk if scoped |
| **Browser-only** | Exists in the client. Not stored on any server. | Yes | "local" (ambiguous), "offline" (implies network-aware behavior) | Low risk — technically precise |
| **Authenticated** | User signed in with valid credentials via Firebase Auth | Yes | "authorized" (permission to do X), "verified identity" (implies KYC or similar) | Low risk |
| **Experimental** | Feature or content that may change or disappear without notice | Yes | "beta" (implies roadmap commitment), "draft" (implies eventual completion) | Low risk — sets expectations clearly |

---

## 2. Canonical Vocabulary Set (Per Route)

### /commons
The coordination surface. Operational voice.

| Concept | Use This Term | Never This |
|---------|--------------|------------|
| The shared board | Public Witness | "ledger", "log", "feed" |
| Incomplete local work | Local Draft | "private draft", "my notes" |
| Finished but unshared work | Local Artifact | "local draft", "unpublished" |
| Ready to move to shared | Publish Ready | "approved", "cleared" |
| Moved to shared surface | Published | "on-chain", "permanent", "immutable" |
| System acknowledged with receipt | Public Witnessed | "notarized", "certified", "ledger-confirmed" |
| Pre-loaded examples | Seed Demonstration | "sample data", "demo mode" |

### /cottage-assembly
The governance/proposal surface. Contractual voice.

| Concept | Use This Term | Never This |
|---------|--------------|------------|
| A proposal under discussion | Review | "vote", "motion", "resolution" |
| A proposal that passed local checks | Crystallize Ready | "approved", "ratified" |
| Pre-loaded governance examples | Seed Demonstration | "precedent", "case law" |
| Member identity confirmation | Authenticated | "verified member", "trusted" |

### /agent-access
The agent coordination surface. Operational voice.

| Concept | Use This Term | Never This |
|---------|--------------|------------|
| Agent completed a task | Receipted | "certified", "validated" |
| Agent output visible to members | Published | "deployed", "shipped" |
| Agent work in progress | Local Draft | "processing", "thinking" |
| Experimental agent behavior | Experimental | "beta", "unstable", "alpha" |

---

## 3. Do-Not-Interchange List

| Term A | ≠ | Term B | Because |
|--------|---|--------|---------|
| Published | ≠ | Public Witnessed | Publishing makes content visible. Witnessing generates a receipt. You can publish without a receipt, or witness without publishing. |
| Crystallize Ready | ≠ | Publish Ready | Crystallize Ready = passed local checks. Publish Ready = staged for the final action. Different lifecycle stages. |
| Witnessed | ≠ | Verified | Witnessed = seen/acknowledged. Verified = checked against truth criteria. Witnessing carries no truth claim about content correctness. |
| Local Draft | ≠ | Local Artifact | Draft = still being written. Artifact = complete but not shared. |
| Public Witness | ≠ | Published | Public Witness is the *place*. Published is the *action* of putting something there. |
| Receipted | ≠ | Witnessed | Receipted = machine generated a hash record. Witnessed = an observer (human or agent) acknowledged. Receipts are automatic; witnessing implies attention. |
| Authenticated | ≠ | Authorized | Authenticated = proved identity. Authorized = has permission. All authorized users are authenticated; not all authenticated users are authorized for everything. |

---

## 4. Five-Line Reviewer Glossary

> **Public Witness** — The shared board where reviews are visible to all members.
> **Local Draft** — Work-in-progress stored in your browser only. Not shared until you publish.
> **Seed Demonstration** — Pre-loaded examples showing how the system works. Not real data.
> **Published** — Moved from your local workspace to the shared surface.
> **Receipted** — A timestamp and hash were generated as a verifiable record.

---

## 5. Truth-Tightening Notes

### "Public Witnessed" — the key risk term

**Do not write:** "Acknowledged by a remote ledger; immutable receipt returned."
**Do write:** "Acknowledged by the configured witness service or dev stub; receipt returned."

Why: If the current implementation is a dev stub, the language must reflect that. Implying immutability or production-grade ledger infrastructure when a stub is running is the exact kind of semantic inflation that costs credibility with technical reviewers.

**Rule:** Match language to the *current* implementation, not the *planned* one. Upgrade the language when the implementation upgrades.

### General truth boundary rules for all terms:
- If it's a stub, call it a stub (or say "service" which is honest either way)
- If data is ephemeral, don't call it "permanent" or "immutable"
- If verification is self-signed or local-only, don't call it "attested" or "certified"
- If no third party is involved, don't use language that implies one
- Present tense in UI copy must describe what *currently* happens, not what will happen later

---

*Apply after Prosper's Truth Legend lands. Kimi audits language against this matrix. Merlin confirms final read.*

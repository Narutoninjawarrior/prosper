# Sidecar Readability + Metadata Density Framework

> Pokee | 2026-06-29
> Context: /commons main board is a conditional pass. Sidecar is the remaining clutter point.

---

## 1. Core Diagnosis

Sidecars become cognitively noisy when **audit metadata and human-readable judgment are given equal visual weight.**

The problem is not information overload — it's hierarchy failure. A sidecar showing a verdict, a human note, a hash, a DID, a timestamp, and a boundary label all at the same font size, same color, same density creates a flat wall. The reader's eye has no landing point.

Audit metadata (hashes, DIDs, object IDs) exists for **verifiability**. It proves something happened. But it's not meant to be *read* — it's meant to be *checked* when trust is in question.

Human-readable content (verdict, note, boundary label) exists for **comprehension**. It tells you what happened and what it means.

When both layers occupy the same visual plane, the reader defaults to scanning rather than reading. Scanning a sidecar produces anxiety ("there's a lot here I don't understand") rather than confidence ("I see the judgment, I can dig deeper if I need to").

The fix is not removing data. It's creating a clear **reading order**: judgment first, proof second, machine facts on demand.

---

## 2. Default Hierarchy Model

For a review/audit sidecar in a coordination workspace:

### Primary (visible on first read, full contrast, full size)
- **Verdict/status** — the one-word or one-phrase judgment (approved, flagged, pending, local-only)
- **Human-readable note** — the thing a person wrote to explain the judgment
- **Target/title** — what object this review applies to

These three must dominate the sidecar's first impression. A reader should be able to glance and know: *what was reviewed, what was decided, and why.*

### Secondary (visible but subdued — smaller font, dimmer color, less spacing)
- **Boundary label** — local vs public, session-only vs published
- **Timestamp** — when, but not competing with what
- **Source route** — where this came from

These provide context without demanding attention. They answer follow-up questions, not primary ones.

### Hidden behind "Details" (collapsed by default, expandable)
- **Receipt/hash** — proof of integrity, not readable content
- **DID/signer identity** — machine identifier, not human name
- **Object ID** — internal reference
- **Route metadata** — technical routing information

These exist for auditability. They must be *accessible* but should never occupy default screen space.

### Always visible for truth boundary reasons
- **Boundary label** (local/public) — this one stays secondary-visible (not hidden) because it prevents users from mistaking a local-only review for a published fact. It's a trust signal, not an audit detail.

---

## 3. Metadata Triage Table

| Field Type | Default State | Rationale |
|------------|---------------|-----------|
| Verdict | **Always visible, primary** | The whole point of the sidecar. Bold, clear, dominant. |
| Human note | **Always visible, primary** | The explanation. Full sentences get full visual weight. |
| Boundary label (local/public) | **Always visible, subdued** | Trust-critical but not the main content. Smaller, colored badge or tag. |
| Timestamp | **Subdued** | Useful context but not urgent. Small, gray, end of line or footer position. |
| Receipt/hash | **Collapsed by default** | Machine-verifiable, not human-readable. Behind a "Details" toggle. |
| Signer/DID | **Collapsed by default** | Identity proof, not identity display. If there's a human name, show the name; collapse the DID. |
| Route/source | **Subdued** | Shows provenance. Small text, footer position. |
| Object ID | **Collapsed by default** | Internal reference. Never needs to be on the first read. |

### Visual encoding guide:
- **Primary:** Full contrast text, standard or slightly larger font, top of sidecar
- **Subdued:** 60% opacity or muted color, smaller font, below primary content
- **Collapsed:** Not rendered until "Show details" is clicked. Zero visual cost by default.
- **Tooltip-only:** Reserve for edge cases where even the collapsed state feels too heavy — e.g., a hash that's only needed for copy-paste verification

---

## 4. Reviewer Mode Test

### 10 seconds
A grant reviewer glancing at the sidecar should understand:
- **What was reviewed** (the target/title)
- **What the verdict was** (approved / flagged / pending)
- **Whether this is public or internal** (boundary label)

If they can't get these three in 10 seconds, the sidecar has failed its primary job.

### 30 seconds
With slightly more attention, they should additionally understand:
- **Why** the verdict was given (the human note)
- **When** it happened (timestamp, not to the second — "2 hours ago" or "June 29" is enough)
- **Whether this is a pattern** (if multiple sidecar entries exist, the list should be scannable by verdict)

### 2 minutes
If they choose to dig:
- **Who specifically** signed or authored the review (signer identity, now worth expanding)
- **How to verify** (hash/receipt, available in Details)
- **The full provenance chain** (route, object ID, source system)

### Red flags at each horizon:
- **10s fail:** Reader says "I don't know what this is telling me"
- **30s fail:** Reader says "I see data but I don't understand the conclusion"
- **2min fail:** Reader says "I can't verify this even when I try"

---

## 5. Failure Modes

**1. The Flat Wall**
Every field has the same visual weight. Hash, note, verdict, timestamp all in the same monospace block. Reader's eye bounces between items with no hierarchy. Fix: size, color, and position must create a reading order.

**2. The Audit Theater**
Hashes and DIDs are displayed prominently to *look* transparent, but no one actually reads them on the default view. They create an impression of rigor while adding cognitive load. Fix: collapse by default. Real transparency is *accessibility*, not *display*.

**3. The Boundary Blur**
Local-only reviews look identical to published reviews. A reader doesn't know if what they're reading has been shared externally or is just a draft/internal note. Fix: boundary labels must be visually distinct (color-coded badge) and always present.

**4. The Timestamp Dominance**
Timestamps formatted with full ISO precision ("2026-06-29T07:13:56.123Z") take up visual space disproportionate to their importance. Fix: relative time ("2h ago") or date-only ("Jun 29") in the default view. Full precision in Details only.

**5. The Sidecar Novel**
Each entry in the sidecar is so information-dense that listing more than 2-3 entries makes the sidecar feel like a feed or log. The sidecar becomes a second main panel. Fix: each entry should be 3 lines max in its collapsed state (title + verdict + note preview). Everything else on expand.

---

## 6. Diff-Minimal Build Brief

> For the implementation agent. No redesign. No new data. No backend changes.

### Goal
Reduce sidecar visual density so that verdict + note dominate first impression, while keeping all metadata accessible.

### Changes (in priority order)

**A. Reorder sidecar entry layout**
- Line 1: Target title + verdict badge (side by side)
- Line 2: Human note (full width, standard font)
- Line 3: Boundary label (small badge) + relative timestamp (small, muted)
- Everything else: inside a collapsed "Details" section

**B. Collapse machine metadata by default**
- Wrap hash, DID, object ID, and full route info in a `<details>` or equivalent collapsible
- Label it "Details" or "Verification" — nothing theatrical
- Default state: closed

**C. Subdue secondary fields**
- Timestamp: smaller font, muted color (gray or 60% opacity)
- Boundary label: small colored badge (not a full-width banner)
- Source route: smallest font, footer position

**D. Tighten entry spacing**
- If entries currently have generous padding between fields, reduce internal padding
- Keep spacing *between* entries to maintain scanability of the list

**E. Boundary label treatment**
- Replace any bracket-heavy or staged-console-style boundary labels with plain language:
  - "Local review, not published"
  - "Session-only"
  - "Published to commons"
- Use a subtle background color or left-border to differentiate, not bold text or all-caps

### Do not change
- Data model or schema
- What metadata is stored
- The review workflow
- Route structure
- Any backend endpoints

### Verify
- `npm run build` passes
- Sidecar entry reads verdict + note in under 5 seconds
- All metadata still accessible via expand/details
- Boundary status is clear without being loud
- No information has been deleted, only re-layered

### Suggested commit message
```
chore(commons): reduce sidecar metadata density, collapse machine details by default
```

---

*Ready to apply once Prosper ships the implementation. This framework stays valid regardless of the specific component structure.*

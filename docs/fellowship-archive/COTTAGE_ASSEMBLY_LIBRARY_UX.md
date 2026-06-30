# Cottage Assembly Library — UX / Truth Memo

> Pokee | 2026-06-29
> For Prosper's local batch library + compare implementation.
> No code. Design guidance only.

---

## 1. What Should Be Primary in the Library Card

Each saved batch card should show these three things at maximum prominence:

- **Product name** — what this is (left-aligned, bold, truncated at ~40 chars)
- **Status chip** — [LOCAL_DRAFT] / [CRYSTALLIZE_READY] / [PUBLISH_READY] / [PUBLIC_WITNESSED] (colored badge, top-right)
- **Last updated** — relative time ("3 min ago", "Yesterday") not ISO timestamp

That's it for the default scan. A builder glances at the library and knows: what, where in the process, how recent.

## 2. What Should Be Secondary or Hidden

**Secondary (visible but subdued — smaller, dimmer):**
- Category
- Whether evidence photo is attached (icon only, no text)
- Measured pH value (small inline number)

**Hidden (expandable or in the detail view only):**
- Digest / artifact ID (long hash — never on the card face)
- Instrument ID
- Measurement method
- Full timestamp (show only on hover or in expanded state)
- Bundle download status
- Dev-stub receipt details

**Rule:** If a human wouldn't say it out loud when describing the batch to a colleague ("it's the olive oil one, local draft, updated just now"), it doesn't go on the card face.

---

## 3. Five Ways This Feature Could Accidentally Imply Cloud Persistence or Production Witnessing

**1. Using "Saved" without "locally"**
"Saved" alone implies server storage. Always say "Saved locally" or "Stored in this browser."

**2. Sync-suggestive icons**
A cloud icon, a checkmark with a circle, or a green "uploaded" indicator near the save button. Use a device/browser icon instead if any icon is needed.

**3. The word "library" without qualifier**
"Library" alone could imply a shared, persistent collection. Label the panel "Local Library" or "Browser Drafts" — never just "Library."

**4. Showing a digest/hash prominently on a local-only draft**
If a hash is visible on a [LOCAL_DRAFT] item, a reviewer might think it's been anchored to something external. Only show the digest after crystallization, and label it: "Local digest — not published."

**5. Status chip saying [PUBLIC_WITNESSED] without context**
If a batch was witnessed by the dev stub, the chip looks the same as a production witness. Add a tiny "dev" qualifier or tooltip: "Acknowledged by dev stub" — not just the badge alone.

---

## 4. Exact Microcopy

| Action | Button/Label Text | Confirmation Text |
|--------|-------------------|-------------------|
| Save locally | **Save to browser** | "Saved locally. This stays in your browser only." |
| Reopen | **Reopen** | "Loaded from local storage." |
| Duplicate | **Duplicate as draft** | "New local draft created from [original name]." |
| Compare | **Compare** (only appears when 2+ items are selected) | No confirmation needed — just open the view |
| Copy digest | **Copy digest** | "Digest copied. This is a local hash, not a published receipt." |
| Re-download bundle | **Download bundle** | "Bundle downloaded locally." |

**Additional labels:**
- Library panel header: "Local Drafts (browser storage)"
- Empty state: "No saved batches yet. Crystallize a batch to save it here."
- Dev-stub receipt: "Dev stub acknowledged — not a production witness."

---

## 5. What the Compare View Should Show First

A reviewer looking at the compare view for 10 seconds should immediately understand:

**Row 1 (header):** Two product names side by side. Bold. Nothing else on that line.

**Row 2:** Status chips for each. Color-coded. If one is [LOCAL_DRAFT] and the other is [CRYSTALLIZE_READY], the difference is instantly visible.

**Row 3–5 (the meat):** Only fields that differ get highlighted. Fields that match are dimmed or collapsed. This answers the question "what changed?" not "what are these two things?"

**Priority order for comparison fields:**
1. Status (most important — are they at different lifecycle stages?)
2. Measured pH / key measurement value
3. Evidence present (yes/no)
4. Category (if different)
5. Instrument ID (if different)
6. Digest (if both are crystallized — show truncated, not full hash)

**If all fields match:** Show a single line: "These batches are identical in all measured fields."

**Do not show in compare by default:**
- Full digest strings (truncate to 8 chars with copy button)
- Timestamps (unless explicitly different dates, not just different seconds)
- Measurement method (unless it actually differs)

---

## Summary Principle

This route is a **workbench**, not a **dashboard**. The library is a drawer you pull open, not a display case. Everything should feel like "my working files" not "the system's records."

The single most important thing to get right: **nothing in the local library should look or feel like it lives anywhere other than this browser session.** If a user clears their browser data, it should be obvious that these drafts will go with it.

---

*Ready for Prosper's implementation. This memo stays useful regardless of component structure.*

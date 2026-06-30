# Route Audit Framework

> For use once the real Prosper2 local build is committed or deployed.
> Written 2026-06-29 by Pokee.

---

## 1. Route Voice Rubric

Every route in the Hearthlands should be classifiable into exactly one voice. If it's two or more, that's the problem.

### Atmospheric
Purpose: Orientation, emotion, identity. "Where am I? What is this place?"

| Criterion | Score 0 | Score 1 | Score 2 |
|-----------|---------|---------|---------|
| Single focal point on load | Multiple competing elements | One primary but others distract | Clear single anchor |
| Text is evocative, not instructional | Mix of poetry and UI labels | Mostly evocative but some ops language leaks | Pure mood, zero ops |
| No interactive controls visible by default | Buttons/forms compete with atmosphere | Controls exist but dimmed/secondary | No controls until user acts |
| Load time feels intentional | Spinner or blank flash | Slight delay with no explanation | Instant or graceful fade-in |
| No data dependency | Shows loading states for data | Partial data shown | Fully static or pre-rendered |

**Pass threshold:** 8/10 minimum. Atmospheric routes must *feel* calm. Any ops leakage fails them.

### Operational
Purpose: Do a thing. Status, controls, inputs, outputs. "What can I do? What's happening?"

| Criterion | Score 0 | Score 1 | Score 2 |
|-----------|---------|---------|---------|
| Primary action is obvious in <2 seconds | Buried or ambiguous | Visible but competing with other content | Immediately clear |
| Data shown is real and current | Fake/placeholder data with no label | Labeled as sample/demo | Live or clearly timestamped |
| No poetry in operational labels | Button says "Breathe into the Bellows" | Mild metaphor but clear intent | Plain: "Start", "Submit", "View" |
| State is honest | Shows "active" when nothing runs | Partially honest | Accurate: idle/running/error/done |
| Empty states are handled | Blank space | Generic "nothing here" | Contextual: "No tasks yet. Create one." |

**Pass threshold:** 8/10. Operational routes must be *useful*. Any confusion about what's real vs decorative fails them.

### Contractual
Purpose: Trust, terms, commitments. "What am I agreeing to? What are the rules?"

| Criterion | Score 0 | Score 1 | Score 2 |
|-----------|---------|---------|---------|
| Language is plain and precise | Jargon or vague promises | Mostly clear with some ambiguity | Every sentence testable |
| No emotional manipulation | "Join the sacred fellowship" | Mild warmth but clear terms | Neutral, factual |
| Obligations are explicit | Implied expectations | Partially stated | Clearly listed: you give X, you get Y |
| Scope is bounded | Unbounded promises | Mostly bounded | Explicit limits and exclusions |
| Exits are visible | No way out mentioned | Mentioned but buried | Clear: "You can leave/delete/revoke at any time" |

**Pass threshold:** 8/10. Contractual surfaces must be *trustworthy*. Any mystification fails them.

### Hybrid (failure state)
A route is hybrid when it tries to be two voices at once. This is almost always a problem.

**Diagnostic questions:**
- Does the page have both a mood-setting hero AND operational controls above the fold?
- Does decorative text compete with actionable labels?
- Are contractual terms embedded in atmospheric copy?
- Does the user have to *decode* what's interactive vs decorative?

**If hybrid:** Split into layers. Primary voice gets the default view. Secondary voice gets a tab, accordion, or separate route.

---

## 2. Commons Review Checklist

Assumptions: `/commons` is a coordination surface where multiple concerns meet — community activity, shared resources, announcements, maybe contribution status. It's the most likely place for mixed signals.

### What should be PRIMARY (visible on load, full width)
- Current state of shared work (what's happening now)
- One clear call-to-action for the most common user intent
- Navigation to deeper sections (not the sections themselves)

### What should be SECONDARY (visible but smaller, below fold or sidebar)
- Recent activity log (compact, not feed-style)
- Member/agent status indicators (if real, not decorative)
- Links to resources or docs

### What should be ARCHIVAL / example-only (collapsed or separate tab)
- Historical logs older than 7 days
- Sample/demo data (clearly labeled "Example")
- Philosophical framing text (belongs on an About page, not an operational surface)
- Verbose descriptions of what things *will* be

### What should COLLAPSE by default
- Anything that requires scrolling past to reach the primary action
- Technical details (expandable on click)
- Agent memory/reflection logs (interesting but not urgent)
- Any list longer than 5 items

### Sidecar readability test
A sidecar (sidebar, drawer, secondary panel) is readable when:
- It has ONE purpose per panel
- Its content doesn't update while you're reading the main content
- It can be closed without losing context
- It doesn't contain calls-to-action that compete with the main area
- Its text is shorter than the main content

A sidecar is OVERLOADED when:
- It has tabs within tabs
- Its scroll height exceeds the main content
- It contains forms or interactive elements
- It shows real-time data that demands attention
- It mixes navigation, content, and status

---

## 3. Three-Minute Reviewer Test

For grant reviewers, investors, or anyone evaluating the project cold.

### Procedure

**0–10 seconds (First Impression)**
- Does the page load without error?
- Is there a clear title/identity?
- Can you tell what this project IS in one glance?
- Red flags: loading spinners, broken images, lorem ipsum, "coming soon" on more than one element

**10–30 seconds (Orientation)**
The reviewer should be able to answer:
- What does this project do? (one sentence)
- Who is it for?
- Is it live/real, or a prototype?

If they can't answer these, the page has failed.

**30 seconds – 3 minutes (Depth)**
The reviewer should be able to answer:
- How does the economic model work? (utility, not speculation)
- What has actually been built? (vs. what's planned)
- Who is working on this? (team/agents)
- What would my money/grant fund specifically?
- Is there evidence of real activity? (commits, logs, timestamps)

**Confusion signals to watch for:**
- "Is this a crypto project?" (EMBER language is too speculative)
- "Is this real or a concept?" (too much future-tense, not enough present-tense evidence)
- "What am I looking at?" (atmospheric voice drowning operational clarity)
- "Who runs this?" (no clear human accountability visible)
- "Is this legal?" (exchange/custody language without disclaimers)

### Scoring
- 3/3 sections clear: grant-ready presentation
- 2/3 clear: needs one cleanup pass
- 1/3 clear: significant rework needed
- 0/3: not ready to show externally

---

## 4. Do-Not-Drift List

Common failure modes when teams mix atmospheric, operational, and contractual voices:

**1. Poetry in buttons**
Symptom: Controls say "Ignite the Bellows" instead of "Start". Users don't know what clicking will do.
Fix: Operational labels must be literal. Save metaphor for headings and hero text only.

**2. Decorative liveness**
Symptom: Animated elements or "live" indicators that aren't connected to real data. Pulse dots, rotating objects, or counters that update on a timer but don't reflect actual state.
Fix: If it moves or updates, it must reflect truth. If it's decorative, make it static.

**3. Contractual terms hidden in atmosphere**
Symptom: Obligations or expectations buried in flowing prose. "By joining the fellowship, you commit to..." in the middle of a welcome message.
Fix: Contractual content gets its own clearly-labeled section. Never embed terms in mood text.

**4. Operational surfaces wearing atmospheric clothes**
Symptom: A dashboard or control panel styled like an art piece. Beautiful but you can't find the status indicator or the submit button.
Fix: Operational routes get clean, minimal styling. White space > texture.

**5. Everything above the fold**
Symptom: Fear of making users scroll, so the landing view is packed with cards, panels, status, links, and CTAs all competing at once.
Fix: One primary element per viewport. Everything else is reachable, not visible by default.

**6. Demo data without labels**
Symptom: Sample numbers, placeholder names, or mock activity shown as if real. Reviewers can't tell what's live.
Fix: Every non-live element must say "Example" or "Sample data" in a visible label.

**7. Role confusion in agent displays**
Symptom: Agent cards that mix their technical role, their philosophical framing, and their operational status in one block.
Fix: Name + role + status. That's it. Philosophy goes in docs, not cards.

**8. Future tense as present tense**
Symptom: "The Tesseract reveals truth" when the Tesseract component currently returns null.
Fix: If it's not built, say "Planned" or don't show it. Never describe unbuilt features in present tense on a live surface.

---

## 5. Exact File Request List

To perform the real route audit, I need these files from the Prosper2 local build (`D:\Hearth\prosper2` or wherever the current working tree is):

### Router / Route definitions
- `src/App.jsx` or `src/main.jsx` (wherever routes are defined)
- Any `router.js`, `routes.js`, `routes/index.js`, or equivalent
- `next.config.js` or `vite.config.js` (if route config lives there)

### Route components (one file per route)
- `/commons` → the component file (e.g., `src/pages/commons.jsx` or `src/routes/commons/`)
- `/workbench` → component file
- `/agent-access` → component file
- `/cottage-assembly` → component file
- `/world` → component file
- `/observatory` → component file

### Layout / shell
- Any shared layout wrapper (e.g., `Layout.jsx`, `Shell.jsx`, `AppShell.jsx`)
- Navigation component (sidebar, header nav, whatever renders route links)
- Any auth gate or route guard component

### Styling
- Global CSS or theme file (variables, tokens)
- Any component-level CSS modules for the routes above

### Data / state
- Any static JSON files loaded by these routes
- Any context providers or stores that feed these pages
- API route files if data comes from a backend

### Config
- `package.json` (to see what framework/router is in use)
- `firebase.json` or deployment config
- `.env.example` or equivalent (to see what services are expected)

### Optional but helpful
- Screenshots or a live URL of the current deployed state
- Any existing README or docs in the Prosper2 build
- Git log of last 10 commits (to understand what "recent cleanup" changed)

---

*This framework is ready to apply the moment real files arrive. No guessing required.*

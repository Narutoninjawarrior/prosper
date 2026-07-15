# PROSPER REFORM — PHASE J: GUT AND SIMPLIFY

Workspace: `D:\Hearth\prosper2`

Grok recently delivered a brutal but necessary verdict on the current state of Prosper. The core takeaway:
> "Prosper/Hearthlands is still more over-engineered personal research console than a product anyone would open daily or pay for... Shift decisively to 'Project continuity & handoff workspace' with ruthless simplification."

Your mandate is to begin executing **Phase J: A Reform Roadmap (Next 2 Weeks)** from this verdict.

## THE GROK VERDICT (Context for you)
- **Move away from**: Fantasy/hearth lore, "Biosphere/Forge/Hall" metaphors, audio protocols, builder marks, public movement vision.
- **Move towards**: Project continuity and handoff workspace. The reliable "single source of truth" layer between chaotic capture and execution tools.
- **Core Loop**: Evidence → Decision log → Auto-draft handoff (one-click compile).
- **Renames**: "Project Frames" → Sections or Views; "Room Packet" → Project Brief / Handoff Packet; "Artifacts" → Evidence Items.

## YOUR IMMEDIATE TASK: GUT AND CLARIFY
You must make ruthless cuts and renames to align with this new reality. Do not be precious about the old lore.

### Step 1: Read the current landscape
Review these files to understand the current homepage, projects page, navigation, and core data structures:
- `frontend/src/LandingPage.tsx`
- `frontend/src/ProjectsPage.tsx`
- `frontend/src/shell/PublicNav.tsx`
- `frontend/src/App.tsx`
- `frontend/src/OperationsPage.tsx`

### Step 2: Ruthless Renames & Simplification
Propose and implement the following changes in a single sweep:
1. **Gut the homepage (`LandingPage.tsx`)**: Remove the "Lodge / Hearthlands" heavy lore. Reframe it immediately as a "Project continuity and handoff workspace."
2. **Rename key terms in UI**:
   - "Project Frames" -> "Sections" or "Views"
   - "Room Packet" -> "Project Brief" or "Handoff Packet"
   - "Artifacts" -> "Evidence Items"
   - "Sovereign Gallery" / "Forge" / "Biosphere" (Demote or remove from primary public navigation in `PublicNav.tsx` if they distract from the core loop).
3. **Clean up `/projects`**: Ensure the default view is focused strictly on: Inbox → Evidence → Decision log → Auto-draft handoff. Remove unnecessary complex states.

### Step 3: Implement & Verify
Make the edits across the relevant frontend files.
Run `npm run build` in the `frontend` directory.
Provide a summary of what was cut, what was renamed, and how the core loop is now clearer.

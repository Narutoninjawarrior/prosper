PROSPER NEXT SLICE — PASSPORT OPERATING SURFACE

Workspace: D:\Hearth\prosper2

Strategic goal:
The passport is currently a navigable proof trail (an archive). The next evolutionary step is to make it an *operating surface*. We need to close the loop from proof trail into execution by providing contextual filtering on target surfaces and adding a "next valid actions" panel directly on the passport.

Priority 1: Contextual Surface Filtering
- Ensure that when a proof link navigates to `/activity`, `/forge`, or `/registry`, the target surface automatically filters to highlight or isolate the specific event/receipt.
- If a user clicks a receipt hash for a task, `/activity` should highlight that exact receipt in the feed.

Priority 2: "Next Valid Actions" Panel
- Add a compact panel to `frontend/src/AgentProfile.tsx` titled "Next Valid Actions".
- This panel should dynamically suggest operations the agent can perform right now, based on their recent activity or available capabilities.
- For example, if they just validated a blueprint, suggest "Claim Tile" (if still applicable via an authenticated route) or "Inspect Apparatus".
- Provide clear, machine-readable links or buttons for these actions so bots don't have to guess their next move.

Priority 3: Truth Sweep & Build Verification
- Ensure any suggested actions respect the read-only / beta-write boundaries we've established.
- Run `npm run build` in both `frontend` and `functions` to verify structural integrity.

Acceptance:
- Clickable proof links visibly filter or highlight their target surfaces.
- `/agent/:id` features a "Next Valid Actions" panel.
- Builds are green.

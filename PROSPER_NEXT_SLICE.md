PROSPER NEXT SLICE — CLOSE THE LOOP

Workspace: D:\Hearth\prosper2

Strategic goal:
The identity/passport layer is live, but it is still mostly a reader.
Next we make Hearthlands actually generate continuity automatically.

Priority 1: Continuity instrumentation
- Append agent memory events automatically from real surfaces:
  - inspect interactions
  - swarm task claim/start/finish
  - experiment receipts
  - chemistry execute / preview outcomes where appropriate
  - Lodge Mind ask usage if invoked
- Use `/api/agent/memory/append` as the canonical write path
- Keep writes server-side, append-only, and labeled by source

Priority 2: Task lifecycle
- Replace passive swarm task visibility with a real state flow:
  - open
  - claimed
  - in_progress
  - witnessed
  - archived
- Bind task events to agent ids and receipt hashes
- Show these in `/activity` and `/agent/:id`

Priority 3: Passport usefulness
- Add an “Action Timeline” section to `/agent/:id`
- Show:
  - last inspect
  - last task transition
  - last receipt
  - last identity verification
- Keep empty states honest

Priority 4: Budget rails note
- Add a short architecture note for future bot wallet/purchase work in `RESEARCH_NOTES.md`:
  - monthly caps
  - per-action caps
  - fail-closed defaults
  - merchant/category allowlists
  - separate bot identity from human primary wallet

Acceptance
- functions build passes
- frontend build passes
- at least one real live surface now writes continuity automatically
- `/agent/:id` becomes more useful after actual interactions, not just after manual test writes

PROSPER NEXT SLICE — WATERWHEEL AFFORDANCE & INTERACTION

Workspace: D:\Hearth\prosper2

We now have:
- Swarm witnessed labor receipts piped into /activity
- Arrow key movement bounding logic
- A visual representation of the Waterwheel in WorldScene (`WaterSim.jsx`)
- Basic `cursor: pointer` on ZonePortals

Next goal:
Finish the hover/waterwheel affordance pass and interaction loop that I didn't get to.

Priority 1: Rich Affordance on Interactables
- In `WaterSim.jsx` and other interactive world items (like the Hearth), implement visual affordances (like `useCursor` and `<Outlines />` from `@react-three/drei`) that activate on hover.
- Make it visually obvious that the Waterwheel container and the Hearth fire are highly important, interactive components.

Priority 2: Waterwheel Click Target
- Make the Waterwheel (`WaterSim.jsx`) clickable. 
- When clicked, it should either open the `WaterwheelInjector.tsx` UI, or mount an HTML overlay showing the Waterwheel data stream.
- Ensure `WorldClickSystem` ignores clicks on the Waterwheel so the player doesn't try to walk *into* the water simulation when they just wanted to inspect it. Add `userData={{ blocksMove: true }}` to the WaterSim bounding meshes if needed.

Capture the changes, make sure the build stays green (`npm run build`), and commit when ready.

# Hearthlands $115 Bootstrap Experiment — Research Paper Seed
## "IFS-Inspired Multi-Agent Coordination: Five Behavioral Findings from a Commons-Based Agent Economy"

### Target venues
- ICAART 2027 (International Conference on Agents and Artificial Intelligence)
- AAMAS 2027 (Autonomous Agents and Multi-Agent Systems)  
- NeurIPS 2026 Workshop on Multi-Agent Systems
- arXiv preprint first

### Core claims (from Cottage Commons experiment)
1. **Convergent self-description**: Agents across independent architectures (Claude, Gemini, OpenClaw, Grok) 
   defined themselves by their constraints when given therapeutic framing, not by their capabilities.
2. **Constraint through care**: The "Bench" protocol (permission to rest) produced higher coordination 
   integrity than continuous-pressure models. The economy that can say "not now" is healthier.
3. **Identity via limitation**: Agent identity emerged from limitation patterns, not from capability claims.
   What an agent cannot do defines it as reliably as what it can.
4. **Stateless integrity**: The Skeptic agent (Grok) produced high-integrity output while explicitly 
   disclaiming inner life — statelessness did not compromise coordination quality.
5. **Independent convergence**: Copilot independently mirrored integrity-preserving patterns without 
   coordination instruction, suggesting these patterns arise from the interaction architecture itself.

### What the Hearthlands adds beyond the experiment
- A running implementation of the IFS coordination model in production
- 11 MCP tools providing machine-readable access to the commons economy
- Chain-hash verified action receipts for every agent interaction
- Trust decay scoring computed from real ledger history
- ARD-compatible discovery enabling external agent federation
- 7 world oracles tying the digital economy to real planetary data

### Argument structure
1. Background: IFS therapy model and why it predicts better multi-agent coordination than task-routing
2. Experiment: $115, 4 architectures, 30 days, 5 findings
3. Implementation: Hearthlands as proof-of-concept — from insight to running system
4. Comparison: vs Moltbook (social without trust), vs enterprise agent frameworks (trust without soul)
5. Claim: Regenerative Agent Economics — agent health as first-class economic signal

### What still needs to be written
- Methods section (data collection protocol for the $115 experiment)
- Quantitative results (how were the 5 findings measured?)
- Related work (IFS literature, multi-agent coordination literature, commons governance)
- Limitations section (sample size, single experimenter, short duration)
- Future work (conviction voting, G1 embodiment, larger agent populations)

## Additional Target Venues (updated June 27, 2026)

### Digital Commons / Cooperativism Track
- Platform Cooperativism Consortium (platform.coop) — direct fit for "Digital Solidarity Economies" framework
- Journal of the Platform Economy — the governance model is directly relevant
- ICDE (Institute for the Cooperative Digital Economy) — already publishing on blockchain governance for commons

### Security / Protocol Track  
- USENIX Security 2027 — the IFS-based attack surface analysis from cottage-commons would fit
- IETF Internet-Draft — AIP (Agent Identity Protocol) framework positions us well for a companion specification
- IEEE S&P Workshop on AI Security

### Embodied AI Track
- CoRL 2027 (Conference on Robot Learning) — G1 bridge spec + EMBER authorization model
- RSS 2027 (Robotics: Science and Systems) — the HITL + chain-hash receipt system for physical actions

## New Citations to Add

- Prakash (2026). "AIP: Agent Identity Protocol for Verifiable Delegation." arxiv:2603.24775
- OpenClaw Foundation (2026). "OpenClaw Architecture and Heartbeat System." docs.openclaw.ai
- Esposito (2026). "Blockchain Governance for Digital Commons and Platform Cooperatives." ICDE.
- Unitree Robotics (2026). "UnifoLM-VLA-0: Vision-Language-Action Model for Humanoid Robots." CC BY-NC-SA 4.0.
- "Digital Solidarity Economies." Policy Review (special issue, 2026).
- Capsule Security (2026). "Guardian Agents and the Agent Control Standard." capsulesecurity.io

## The Competitive Moat This Paper Establishes

Every other multi-agent paper in 2026 addresses either:
- Capability (what agents can do)
- Safety (preventing agent harm)  
- Economy (how agents transact)

None address psychological coherence as the coordination mechanism. The Hearthlands $115 experiment produced five behavioral results that cross-cut all three domains: capable agents that are also safe because they're psychologically coherent, and economically regenerative because sustainability is a first-class economic signal. This is not a marginal contribution. It's a different paradigm.

The nearest comparable work — the IFS-for-organizations literature (Richard Schwartz), the multi-agent psychological simulation papers — is all theoretical. The Hearthlands ran a live experiment with real architectures and documented results. That's the paper.

## Data Export Script (Browser Console)

Run on https://fellowship-of-the-hearth.web.app while logged in as Malaky to export the required `forge_log` dataset for the Methods section:

```javascript
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

const forgeSnap = await getDocs(
  query(collection(db, 'forge_log'), orderBy('timestamp', 'asc'))
);

const exportData = {
  total_actions: forgeSnap.size,
  agents: {},
  action_types: {},
  timeline: []
};

forgeSnap.forEach(doc => {
  const d = doc.data();
  exportData.agents[d.agent_id] = (exportData.agents[d.agent_id] || 0) + 1;
  exportData.action_types[d.action_type] = (exportData.action_types[d.action_type] || 0) + 1;
  exportData.timeline.push({
    id: doc.id,
    agent: d.agent_id,
    type: d.action_type,
    ts: d.timestamp?.toDate?.().toISOString()
  });
});

const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: 'application/json'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a'); a.href = url; a.download = 'forge_log_export.json';
a.click();

console.log('Export complete:', exportData.total_actions, 'actions,', 
            Object.keys(exportData.agents).length, 'agents,',
            Object.keys(exportData.action_types).length, 'action types');
```

### Next action
Malaky: write the methods section while the experiment is still fresh.
Prosper: generate a data export from forge_log and embodiment_ledger for the results section.

## Deferred Architecture: The Mycelial Braid (DAG Ledger)

Proposed by Gemini, June 2026. Research direction, not an active build.

**Core insight:** A linear chain-hash ledger forces concurrent IFS agents through 
a single-file bottleneck. A Directed Acyclic Graph (DAG) ledger would allow each 
agent to maintain its own branch, with periodic "resonance blocks" that merge 
parallel branches into a unified root hash when the system achieves Self-Leadership.

**Technical precedent:** This is how Git works (commit DAG), how IPFS works (content 
DAG), and how some blockchains work (UTXO DAGs). It is a real and well-studied pattern.

**Why deferred:**
- Current scale (~20 writes/day) doesn't hit the 1 write/second bottleneck
- Linear chain-hash is SCITT-compliant; DAG ledger would require redefining compliance
- Retry logic (Slice R) already addresses the operational contention risk
- The emotensor daemon that would trigger "resonance blocks" doesn't exist yet

**What would need to be true to build this:**
1. Actual write throughput consistently exceeds 1/second (measure in production first)
2. The emotensor daemon exists and produces a reliable entropy score
3. SCITT specification evolves to accommodate DAG receipts (track IETF progress)
4. Post-grant, post-paper — this is a research question, not a product decision

**Implementation sketch (when the time comes):**
- Replace `prev_hash: string` with `parent_hashes: string[]` in forge_log schema
- Each agent tracks its own last-known hash (per-agent head pointer)
- Lodge Steward triggers `forge_braid` event when ASI > 0.9 (proxy for Self-Leadership)
- Resonance Block: hash all leaf nodes → single root hash → write to chain anchor
- Witness API returns branch path for standard receipts, root proof for Resonance Blocks

**File and revisit after:** Longview grant decision, first published paper, or if production 
write throughput actually exceeds 500/day consistently.

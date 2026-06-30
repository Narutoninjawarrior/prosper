import { sha256Hex } from './grace';

export interface AgentClaim {
  agentId: string;
  agentName: string;
  promptId: string;
  claimedAt: number;
  estimatedCompletion: number; // ms
  status: 'claiming' | 'working' | 'completed' | 'failed';
}

export interface Receipt {
  id: string;
  promptId: string;
  agentId: string;
  agentName: string;
  completedAt: number;
  hash: string;
  output: string;
}

export function simulateAgentClaim(
  promptId: string, 
  onClaimUpdate: (claim: AgentClaim) => void,
  onComplete: (receipt: Receipt) => void
) {
  const agents = [
    { id: 'agent-kael', name: 'Kael', speed: 3000 },
    { id: 'agent-mira', name: 'Mira', speed: 5000 },
    { id: 'agent-ordo', name: 'Ordo', speed: 2000 },
  ];
  
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const claim: AgentClaim = {
    agentId: agent.id,
    agentName: agent.name,
    promptId,
    claimedAt: Date.now(),
    estimatedCompletion: agent.speed,
    status: 'claiming',
  };
  
  onClaimUpdate(claim);

  // Transition to working
  setTimeout(() => {
    claim.status = 'working';
    onClaimUpdate({ ...claim });
  }, 800);

  // Complete work and generate receipt
  setTimeout(async () => {
    claim.status = 'completed';
    onClaimUpdate({ ...claim });

    const hashPayload = {
      promptId,
      agentId: agent.id,
      completedAt: Date.now(),
      vessel: 'hearthlands-doctrine-forge-v1',
      output: `Task successfully executed by ${agent.name} via Hearthlands local sandbox.`
    };
    
    // Calculate SHA-256 hash asynchronously
    const hash = await sha256Hex(JSON.stringify(hashPayload));

    const receipt: Receipt = {
      id: `receipt-${promptId}-${agent.id}`,
      promptId,
      agentId: agent.id,
      agentName: agent.name,
      completedAt: Date.now(),
      hash,
      output: `Completed task execution: synthesized coordination vector for prompt [${promptId}]. Output signature verified on-chain proxy.`,
    };

    // Store in sessionStorage
    const receipts = JSON.parse(sessionStorage.getItem('hearth_receipts') || '[]');
    receipts.push(receipt);
    sessionStorage.setItem('hearth_receipts', JSON.stringify(receipts));

    onComplete(receipt);
  }, agent.speed);
}

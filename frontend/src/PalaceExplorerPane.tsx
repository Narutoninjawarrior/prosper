import { ReactFlow, Controls, Background } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AgentNode, DefaultNode } from './CustomNodes';

const initialNodes: Node[] = [
  { id: '1', type: 'agentNode', position: { x: 300, y: 50 }, data: { label: 'Solis', agent: 'solis' } },
  { id: '2', type: 'agentNode', position: { x: 100, y: 50 }, data: { label: 'Prosper2', agent: 'prosper2' } },
  { id: '4', type: 'defaultNode', position: { x: 200, y: 200 }, data: { label: 'Phoenix Ledger / MemPalace' } },
];

const initialEdges: Edge[] = [
  { id: 'e1-4', source: '1', target: '4', animated: true, style: { stroke: '#d97706' } },
  { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: '#3b82f6' } },
];

export default function PalaceExplorerPane() {
  return (
    <div className="flex-1 w-full relative">
      <div className="absolute top-0 left-0 border-b border-gray-800/50 bg-[#0a120e]/60 flex justify-between items-center z-10 w-full backdrop-blur-sm p-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></div>
          <h2 className="text-sm font-semibold tracking-wide text-gray-300">MemPalace Topology</h2>
        </div>
      </div>
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={{ agentNode: AgentNode, defaultNode: DefaultNode }}
        colorMode="dark"
        fitView
      >
        <Background color="#10b981" gap={24} size={1} style={{ opacity: 0.1 }} />
        <Controls style={{ backgroundColor: 'rgba(20, 26, 22, 0.8)', border: '1px solid rgba(16,185,129,0.2)' }} />
      </ReactFlow>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { ReactFlow, Controls, Background, Handle, Position } from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Network, Cpu, Box, Gamepad2, ShieldAlert, User, Wrench, Zap, Droplets, Wallet, Coins } from 'lucide-react';
import './index.css';
import HearthlandsGame from './Hearthlands';
import Toolbox from './Toolbox';
import EaseOfFlow from './EaseOfFlow';
import ForgePage from './ForgePage';
import HallOfHonor from './HallOfHonor';
import WaterwheelInjector from './WaterwheelInjector';
import LobsterLeasing from './LobsterLeasing';
import TreasuryDonation from './TreasuryDonation';
import ThreeForge from './ThreeForge';
import SOLCOTShop from './SOLCOTShop';
import PublicShell from './PublicShell';
import WorldRoute from './WorldRoute';
import BiosphereRoute from './BiosphereRoute';
import WelcomeRoute from './WelcomeRoute';
import RegistryExplorer from './RegistryExplorer';
import AgentAccess from './AgentAccess';

export function AgentNode({ data }: NodeProps) {
  const agentId = data.agent as string;
  let colors = { text: '#10b981', border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', shadow: 'rgba(16, 185, 129, 0.4)' };
  let Icon = Cpu;
  let labelTag = "Agent Wing";
  if (agentId === 'solis') { colors = { text: '#d97706', border: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', shadow: 'rgba(217, 119, 6, 0.4)' }; Icon = ShieldAlert; labelTag="Sys Strategist"; } 
  else if (agentId === 'prosper2') { colors = { text: '#3b82f6', border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', shadow: 'rgba(59, 130, 246, 0.4)' }; Icon = User; labelTag="Lead Dev";}
  
  return (
    <div className="px-4 py-3 rounded-lg flex items-center gap-3 font-mono" style={{ border: `1px solid ${colors.border}`, backgroundColor: colors.bg, color: '#e2e8f0', boxShadow: `0 0 15px ${colors.shadow}` }}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Icon size={20} style={{ color: colors.text }} />
      <div className="flex flex-col pr-2">
        <span className="text-[10px] uppercase font-bold" style={{ color: colors.text }}>{labelTag}</span>
        <span className="text-sm text-gray-300">{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-500 rounded-none mix-blend-screen" />
    </div>
  );
}

export function DefaultNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900/80 text-gray-200 text-xs font-sans shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-gray-400 rounded-sm"/>
      <div className="flex items-center justify-center gap-2 text-center whitespace-pre-wrap"><Box size={14} className="text-gray-400"/><span>{data.label as string}</span></div>
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-gray-400 rounded-sm" />
    </div>
  );
}

const initialNodes: Node[] = [
  { id: '1', type: 'agentNode', position: { x: 300, y: 50 }, data: { label: 'Solis', agent: 'solis' } },
  { id: '2', type: 'agentNode', position: { x: 100, y: 50 }, data: { label: 'Prosper2', agent: 'prosper2' } },
  { id: '4', type: 'defaultNode', position: { x: 200, y: 200 }, data: { label: 'Phoenix Ledger / MemPalace' } },
];
const initialEdges: Edge[] = [
    { id: 'e1-4', source: '1', target: '4', animated: true, style: { stroke: '#d97706'} }, 
    { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: '#3b82f6'} }
];

import Gate from './Gate';

function App() {
  const [activeTab, setActiveTab] = useState('flow');
  const [lmStatus, setLmStatus] = useState('Checking port 1234...');
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem('hearth_unlocked') === 'true';
  });

  const handleUnlock = () => {
    sessionStorage.setItem('hearth_unlocked', 'true');
    setUnlocked(true);
  };

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1500);

    fetch('http://localhost:1234/v1/models', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setLmStatus(`Online  /  ${data.data.length} Models`))
      .catch(() => setLmStatus('Offline / Waiting for LM Studio'))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  if (window.location.pathname === '/treasury') {
    return (
      <PublicShell className="h-screen w-screen bg-[#020804] text-gray-200">
        <TreasuryDonation />
      </PublicShell>
    );
  }

  if (window.location.pathname === '/solcot') {
    return (
      <PublicShell className="h-screen w-screen bg-[#020804] text-gray-200">
        <SOLCOTShop />
      </PublicShell>
    );
  }

  if (window.location.pathname === '/world') {
    return (
      <PublicShell className="h-screen w-screen bg-[#020804] text-gray-200">
        <WorldRoute />
      </PublicShell>
    );
  }

  if (window.location.pathname === '/biosphere') {
    return (
      <PublicShell className="h-screen w-screen bg-[#0A0402] text-gray-200">
        <BiosphereRoute />
      </PublicShell>
    );
  }

  if (window.location.pathname === '/welcome') {
    return <WelcomeRoute />;
  }

  if (window.location.pathname === '/hall') {
    return (
      <PublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200">
        <div className="h-full overflow-y-auto">
          <HallOfHonor />
        </div>
      </PublicShell>
    );
  }

  if (window.location.pathname === '/registry') {
    return (
      <PublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200">
        <div className="h-full overflow-y-auto">
          <RegistryExplorer />
        </div>
      </PublicShell>
    );
  }

  if (window.location.pathname === '/agent-access') {
    return (
      <PublicShell className="min-h-screen w-screen bg-[#020804] text-gray-200">
        <div className="h-full overflow-y-auto">
          <AgentAccess />
        </div>
      </PublicShell>
    );
  }

  if (window.location.pathname === '/3dforge') {
    return (
      <PublicShell className="h-screen w-screen bg-[#020804] text-gray-200">
        <ThreeForge agentId="human" />
      </PublicShell>
    );
  }

  if (window.location.pathname === '/forge') {
    return (
      <PublicShell className="h-screen w-screen bg-[#020804] text-gray-200">
        <ForgePage />
      </PublicShell>
    );
  }

  if (!unlocked) {
    return <Gate onUnlock={handleUnlock} />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#020804] text-gray-200 font-sans">
      <div className="w-72 glass-panel m-4 flex flex-col p-5">
        <h1 className="text-2xl font-bold text-[#10b981] flex items-center gap-3 mb-10 tracking-wider">
          <Bot size={28} /> HEARTH OS
        </h1>
        <div className="flex flex-col gap-3">
          <button onClick={() => setActiveTab('graph')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'graph' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Network size={20} /> Palace Explorer
          </button>
          <button onClick={() => setActiveTab('hearthlands')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'hearthlands' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Gamepad2 size={20} /> Hearthlands Farm
          </button>
          <button onClick={() => setActiveTab('multitool')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'multitool' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Wrench size={20} /> Multi-Tool Hub
          </button>
          <button onClick={() => setActiveTab('3dforge')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === '3dforge' ? 'bg-[#d97706]/15 text-[#d97706] border border-[#d97706]/30 shadow-[0_0_15px_rgba(217,119,6,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Box size={20} /> 3D Forge (MCP)
          </button>
          <button onClick={() => setActiveTab('flow')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'flow' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Zap size={20} /> Ease of Flow
          </button>
          <button onClick={() => setActiveTab('waterwheel')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'waterwheel' ? 'bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Droplets size={20} /> Waterwheel
          </button>
          <button onClick={() => setActiveTab('lobster')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'lobster' ? 'bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Cpu size={20} /> Lobster Atelier
          </button>
          <button onClick={() => setActiveTab('treasury')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'treasury' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Wallet size={20} /> Sovereign Treasury
          </button>
          <button onClick={() => setActiveTab('solcot')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'solcot' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Coins size={20} /> SOLCOT Shop
          </button>
        </div>
        <div className="mt-auto pt-5 border-t border-gray-800 px-1">
          <h3 className="text-[11px] text-gray-500 mb-3 uppercase tracking-widest font-bold flex items-center gap-2">
            <Cpu size={14} /> AI Connection Link
          </h3>
          <div className={`p-4 rounded-xl border ${lmStatus.includes('Online') ? 'bg-[#10b981]/10 border-[#10b981]/40 text-[#10b981]' : 'bg-[#ef4444]/10 border-[#ef4444]/40 text-[#ef4444]'} text-[12px] font-mono break-words shadow-inner transition-all duration-1000`}>
            LOCAL: {lmStatus}
          </div>
        </div>
      </div>

      <div className="flex-1 my-4 mr-4 glass-panel relative overflow-hidden flex flex-col shadow-2xl p-4">
        {activeTab === 'graph' && (
          <div className="flex-1 w-full relative">
            <div className="absolute top-0 left-0 border-b border-gray-800/50 bg-[#0a120e]/60 flex justify-between items-center z-10 w-full backdrop-blur-sm p-4">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_#10b981]"></div><h2 className="text-sm font-semibold tracking-wide text-gray-300">MemPalace Topology</h2></div>
            </div>
            <ReactFlow nodes={initialNodes} edges={initialEdges} nodeTypes={{agentNode: AgentNode, defaultNode: DefaultNode}} colorMode="dark" fitView>
              <Background color="#10b981" gap={24} size={1} style={{ opacity: 0.1 }}/>
              <Controls style={{ backgroundColor: 'rgba(20, 26, 22, 0.8)', border: '1px solid rgba(16,185,129,0.2)' }}/>
            </ReactFlow>
          </div>
        )}
        {activeTab === 'hearthlands' && <HearthlandsGame />}
        {activeTab === 'multitool' && <Toolbox />}
        {activeTab === 'flow' && <EaseOfFlow />}
        {activeTab === '3dforge' && <ThreeForge agentId="human" />}
        {activeTab === 'forge' && <div className="h-full overflow-y-auto"><ForgePage /></div>}
        {activeTab === 'hall' && <div className="h-full overflow-y-auto"><HallOfHonor /></div>}
        {activeTab === 'waterwheel' && <div className="h-full overflow-y-auto"><WaterwheelInjector /></div>}
        {activeTab === 'lobster' && <div className="h-full overflow-y-auto"><LobsterLeasing /></div>}
        {activeTab === 'treasury' && <div className="h-full overflow-y-auto"><TreasuryDonation /></div>}
        {activeTab === 'solcot' && <div className="h-full overflow-y-auto"><SOLCOTShop /></div>}
      </div>
    </div>
  );
}
export default App;

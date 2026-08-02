import { lazy, Suspense, useEffect, useState } from 'react';
import { Bot, Gamepad2, Cpu, Wrench, Zap, Droplets } from 'lucide-react';
import HermesConsole from './HermesConsole';

const HearthlandsGame = lazy(() => import('./Hearthlands'));
const Toolbox = lazy(() => import('./Toolbox'));
const EaseOfFlow = lazy(() => import('./EaseOfFlow'));
const HallOfHonor = lazy(() => import('./HallOfHonor'));
const WaterwheelInjector = lazy(() => import('./WaterwheelInjector'));
const LobsterLeasing = lazy(() => import('./LobsterLeasing'));

type TabId =
  | 'hearthlands'
  | 'multitool'
  | 'flow'
  | 'waterwheel'
  | 'lobster'
  | 'hall'
  | 'hermes';

function LoadingPane({ label = 'Loading pane...' }: { label?: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm uppercase tracking-[0.28em] text-[#6b7c70]">
      {label}
    </div>
  );
}

export default function InternalAppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('flow');
  const [lmStatus, setLmStatus] = useState('Checking port 1234...');

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

  function renderActivePane() {
    switch (activeTab) {
      case 'hearthlands':
        return <HearthlandsGame />;
      case 'multitool':
        return <Toolbox />;
      case 'flow':
        return <EaseOfFlow />;
      case 'hall':
        return <div className="h-full overflow-y-auto"><HallOfHonor /></div>;
      case 'waterwheel':
        return <div className="h-full overflow-y-auto"><WaterwheelInjector /></div>;
      case 'lobster':
        return <div className="h-full overflow-y-auto"><LobsterLeasing /></div>;
      case 'hermes':
        return <HermesConsole />;
      default:
        return <EaseOfFlow />;
    }
  }

  return (
    <div className="flex h-screen w-screen bg-[#020804] text-gray-200 font-sans">
      <div className="w-72 glass-panel m-4 flex flex-col p-5">
        <a
          href="/"
          className="flex items-center gap-2 mb-6 rounded-xl border border-[#E8842A]/40 bg-[#E8842A]/15 px-3.5 py-2 text-xs font-bold tracking-[0.16em] uppercase text-[#FAF6EF] shadow-[0_0_15px_rgba(232,132,42,0.2)] transition hover:bg-[#E8842A]/25 no-underline"
        >
          <span>← Hearth Home</span>
        </a>
        <h1 className="text-2xl font-bold text-[#10b981] flex items-center gap-3 mb-10 tracking-wider">
          <Bot size={28} /> HEARTH OS
        </h1>
        <div className="flex flex-col gap-3">
          <button onClick={() => setActiveTab('hearthlands')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'hearthlands' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Gamepad2 size={20} /> Hearthlands Farm
          </button>
          <button onClick={() => setActiveTab('multitool')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'multitool' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Wrench size={20} /> Multi-Tool Hub
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
          <button onClick={() => setActiveTab('hermes')} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-semibold ${activeTab === 'hermes' ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]' : 'hover:bg-white/5 border border-transparent'}`}>
            <Cpu size={20} /> Hermes Console
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
        <Suspense fallback={<LoadingPane label="Loading Hearth OS pane..." />}>
          {renderActivePane()}
        </Suspense>
      </div>
    </div>
  );
}

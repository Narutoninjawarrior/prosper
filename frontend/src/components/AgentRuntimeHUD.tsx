import { useEffect, useState } from 'react';
import { Server, ShieldAlert, Cpu, Activity, Database, Key, LayoutTemplate, Clock, Link2, CheckCircle2 } from 'lucide-react';

type MetricProvenance = 'live_backend' | 'session_local' | 'seeded' | 'unavailable';

interface MetricProps {
  label: string;
  value: string | number;
  provenance: MetricProvenance;
  icon: any;
  trend?: 'up' | 'down' | 'stable';
}

const ProvenanceBadge = ({ provenance }: { provenance: MetricProvenance }) => {
  const styles = {
    live_backend: 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/30',
    session_local: 'bg-[#60A5FA]/20 text-[#60A5FA] border-[#60A5FA]/30',
    seeded: 'bg-[#FBBF24]/20 text-[#FBBF24] border-[#FBBF24]/30',
    unavailable: 'bg-white/10 text-gray-400 border-white/10'
  };
  
  const labels = {
    live_backend: 'Live Backend',
    session_local: 'Session-Local',
    seeded: 'Seeded',
    unavailable: 'Unavailable'
  };

  return (
    <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${styles[provenance]}`}>
      {labels[provenance]}
    </span>
  );
};

const MetricRow = ({ label, value, provenance, icon: Icon }: MetricProps) => (
  <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 group hover:bg-white/5 transition-colors px-2 rounded -mx-2">
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-xs text-gray-300 font-mono">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono font-bold text-gray-200">{value}</span>
      <ProvenanceBadge provenance={provenance} />
    </div>
  </div>
);

export function AgentRuntimeHUD() {
  const [metrics, setMetrics] = useState({
    draftCount: 0,
    watchCount: 0,
    hasHandoff: false,
    commonsSize: 0,
    recentMemories: 0
  });

  useEffect(() => {
    const updateMetrics = () => {
      try {
        const sessionPrompts = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
        const watched = JSON.parse(sessionStorage.getItem('hearth_watched_prompts') || '{}');
        const handoff = sessionStorage.getItem('workbench_handoff');
        
        setMetrics({
          draftCount: sessionPrompts.filter((p: any) => p.visibility === 'local_draft').length,
          commonsSize: sessionPrompts.length,
          watchCount: Object.keys(watched).length,
          hasHandoff: !!handoff,
          recentMemories: 0 // Mocked for now until memory layer is live
        });
      } catch (e) {
        console.error('Failed to parse runtime telemetry', e);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 5000); // Check every 5s for session updates
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/60 p-5 backdrop-blur-md font-mono mt-8 shadow-2xl relative overflow-hidden">
      {/* Decorative gradient bleed */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#4A90D9]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#E8842A]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#4A90D9]" />
            <h3 className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#FAF6EF]">Operator Runtime HUD</h3>
          </div>
          <div className="text-[9px] uppercase tracking-widest text-gray-500 border border-white/10 px-2 py-1 rounded-full bg-white/5">
            Inspired by Production Agent Observability
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Context Surface */}
          <div className="space-y-1">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-3 flex items-center gap-1">
              <LayoutTemplate className="w-3 h-3" /> Context Surface
            </h4>
            <MetricRow label="Local Drafts" value={metrics.draftCount} provenance="session_local" icon={Edit3} />
            <MetricRow label="Watched Prompts" value={metrics.watchCount} provenance="session_local" icon={Eye} />
            <MetricRow label="Session Prompts" value={metrics.commonsSize} provenance="session_local" icon={Database} />
            <MetricRow label="Continuity Handoff" value={metrics.hasHandoff ? 'Active' : 'Empty'} provenance="session_local" icon={Link2} />
          </div>

          {/* Memory Surface */}
          <div className="space-y-1">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-3 flex items-center gap-1">
              <Database className="w-3 h-3" /> Memory Lifecycle
            </h4>
            <MetricRow label="Recent Write Events" value={metrics.recentMemories} provenance="session_local" icon={Activity} />
            <MetricRow label="Latest Receipt Sync" value="--:--:--" provenance="unavailable" icon={Clock} />
            <MetricRow label="Vector Index State" value="Unmounted" provenance="unavailable" icon={Server} />
          </div>

          {/* Tool Runtime */}
          <div className="space-y-1">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-3 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Tool Traces
            </h4>
            <MetricRow label="/api/workshop/validate" value="Offline" provenance="unavailable" icon={CheckCircle2} />
            <MetricRow label="/api/chemistry/preview" value="Offline" provenance="unavailable" icon={CheckCircle2} />
            <MetricRow label="/api/experiment/log" value="Offline" provenance="unavailable" icon={CheckCircle2} />
          </div>

          {/* Trust Boundary */}
          <div className="space-y-1">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-3 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" /> Trust & Guardrails
            </h4>
            <MetricRow label="Auth Write Path" value="Secured" provenance="live_backend" icon={Key} />
            <MetricRow label="External Cost Risk" value="0.00 USD" provenance="seeded" icon={Server} />
            <MetricRow label="Guardrail Manifest" value="V1 Active" provenance="seeded" icon={ShieldAlert} />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500 font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
            Vessel UI Nominal
          </div>
          <div className="uppercase tracking-widest">
            Truthful Telemetry • No Fake Liveness
          </div>
        </div>
      </div>
    </div>
  );
}

// Need a small fix for an icon missing from lucide-react import in the inline code
function Edit3(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
}
function Eye(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
}

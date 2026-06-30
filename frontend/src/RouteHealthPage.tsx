import { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, Clock, Info, ShieldAlert } from 'lucide-react';

type StatusGrammar = 'Available' | 'Degraded' | 'Unavailable' | 'Local-only' | 'Paused' | 'Checking...';

interface RouteCheck {
  id: string;
  path: string;
  type: 'spa_route' | 'static_json' | 'static_text';
  label: string;
  status: StatusGrammar;
  lastChecked: number | null;
  note?: string;
}

export default function RouteHealthPage() {
  const [routes, setRoutes] = useState<RouteCheck[]>([
    { id: 'commons', path: '/commons', type: 'spa_route', label: 'The Commons', status: 'Checking...', lastChecked: null },
    { id: 'forge', path: '/forge', type: 'spa_route', label: 'The Forge', status: 'Checking...', lastChecked: null },
    { id: 'entitlements', path: '/entitlements', type: 'spa_route', label: 'Bot Entitlements', status: 'Checking...', lastChecked: null },
    { id: 'activity', path: '/activity', type: 'spa_route', label: 'Activity Feed', status: 'Checking...', lastChecked: null },
    { id: 'heartbeat', path: '/heartbeat.json', type: 'static_json', label: 'System Heartbeat', status: 'Checking...', lastChecked: null },
    { id: 'discovery', path: '/.well-known/ai-discovery.json', type: 'static_json', label: 'AI Discovery Manifest', status: 'Checking...', lastChecked: null },
    { id: 'llms', path: '/llms.txt', type: 'static_text', label: 'LLM Guide', status: 'Checking...', lastChecked: null },
  ]);

  const [lastSweep, setLastSweep] = useState<number | null>(null);

  useEffect(() => {
    const checkRoutes = async () => {
      const updated = await Promise.all(routes.map(async (route) => {
        const now = Date.now();
        try {
          if (route.type === 'spa_route') {
            // Client-side routes are guaranteed available if the JS bundle is running,
            // but we fetch to ensure the server returns 200 (index.html fallback).
            const res = await fetch(route.path, { method: 'HEAD', cache: 'no-cache' });
            return { ...route, status: res.ok ? 'Available' : 'Unavailable', lastChecked: now, note: res.ok ? 'Verified via HEAD' : `HTTP ${res.status}` } as RouteCheck;
          } else {
            // Static assets
            const res = await fetch(route.path, { cache: 'no-cache' });
            if (res.ok) {
              return { ...route, status: 'Available', lastChecked: now, note: `HTTP 200 OK` } as RouteCheck;
            } else if (res.status === 404) {
              return { ...route, status: 'Unavailable', lastChecked: now, note: 'HTTP 404 Not Found' } as RouteCheck;
            } else if (res.status === 503) {
              return { ...route, status: 'Paused', lastChecked: now, note: 'HTTP 503 System Frozen' } as RouteCheck;
            } else {
              return { ...route, status: 'Degraded', lastChecked: now, note: `HTTP ${res.status}` } as RouteCheck;
            }
          }
        } catch (error) {
          return { ...route, status: 'Unavailable', lastChecked: now, note: 'Network Error' } as RouteCheck;
        }
      }));

      setRoutes(updated);
      setLastSweep(Date.now());
    };

    checkRoutes();
  }, []); // Run once on mount

  const availableCount = routes.filter(r => r.status === 'Available' || r.status === 'Local-only').length;

  return (
    <div className="min-h-screen bg-[#050806] text-gray-200 font-mono p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-4xl">
        <header className="mb-10 border-b border-[#2A1F16] pb-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold text-[#E8842A] flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5" />
              Route Health & Source Availability
            </h1>
            <p className="text-[#8a7a64] text-sm leading-relaxed max-w-xl mb-4">
              Simple read-only sanity check of Hearthlands public surfaces.
            </p>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-flex px-3 py-1.5 rounded">
              Availability status. Not a security audit. Public read-only.
            </div>
          </div>
          {lastSweep && (
            <div className="text-right flex flex-col items-end">
              <div className="text-[#34D399] font-bold text-sm uppercase tracking-wider mb-1">
                {availableCount} of {routes.length} Available
              </div>
              <div className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last check: {new Date(lastSweep).toLocaleTimeString()}
              </div>
            </div>
          )}
        </header>

        <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg overflow-hidden shadow-lg mb-10">
          <div className="divide-y divide-[#1A1410]">
            {routes.map((route) => (
              <div key={route.id} className="p-4 md:px-6 flex items-center justify-between hover:bg-[#110D0A] transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-[#c9bba5] text-sm">{route.path}</span>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 px-2 border border-[#2A1F16] rounded bg-black/40">
                      {route.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    {route.note || 'Awaiting ping...'}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex flex-col items-end">
                    <span className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-1.5 ${
                      route.status === 'Available' ? 'text-[#34D399]' :
                      route.status === 'Degraded' ? 'text-[#FBBF24]' :
                      route.status === 'Local-only' ? 'text-[#60A5FA]' :
                      route.status === 'Paused' ? 'text-[#E8842A]' :
                      route.status === 'Checking...' ? 'text-gray-500' :
                      'text-[#EF4444]'
                    }`}>
                      {route.status === 'Available' && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {route.status === 'Degraded' && <AlertCircle className="w-3.5 h-3.5" />}
                      {route.status === 'Unavailable' && <ShieldAlert className="w-3.5 h-3.5" />}
                      {route.status === 'Paused' && <ShieldAlert className="w-3.5 h-3.5" />}
                      {route.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Truth Legend */}
        <div className="bg-[#0A0604] border border-[#1A1410] rounded-lg p-5 shadow-lg">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-4 flex items-center gap-2 border-b border-[#2A1F16] pb-3">
            <Info className="w-4 h-4" /> Truth Legend
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[#34D399] mt-1" />
              <div>
                <span className="font-bold text-[#34D399] uppercase tracking-wider">Available</span>
                <p className="text-gray-400 mt-0.5">Loaded successfully. The route or source is reachable and functioning as expected.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[#FBBF24] mt-1" />
              <div>
                <span className="font-bold text-[#FBBF24] uppercase tracking-wider">Degraded</span>
                <p className="text-gray-400 mt-0.5">Reachable but missing a dependency, returning an unexpected status, or structurally incomplete.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[#60A5FA] mt-1" />
              <div>
                <span className="font-bold text-[#60A5FA] uppercase tracking-wider">Local-only</span>
                <p className="text-gray-400 mt-0.5">Works only in current browser/session context. No backend persistence available.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-[#E8842A] mt-1" />
              <div>
                <span className="font-bold text-[#E8842A] uppercase tracking-wider">Paused</span>
                <p className="text-gray-400 mt-0.5">Intentionally blocked by an operator freeze. Traffic is halted at the gate.</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 pt-4 border-t border-[#2A1F16] text-[10px] text-[#8a7a64] italic">
            This surface provides a simple read-only sanity check. It does not replace full observability pipelines or claim to offer sub-second SLO monitoring.
          </div>
        </div>

      </div>
    </div>
  );
}

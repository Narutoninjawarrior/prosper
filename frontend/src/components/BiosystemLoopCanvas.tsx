import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { ValidationReport } from '../lib/constraintValidator';
import { generateSuggestions } from '../lib/biosystemSuggestionEngine';
import type { BiosystemSuggestion } from '../lib/biosystemSuggestionEngine';
import SuggestionPanel from './SuggestionPanel';
import NetworkSuggestionPanel from './NetworkSuggestionPanel';

export type BiosystemNodeType = 'RESERVOIR' | 'PUMP' | 'GROW_BED' | 'RETURN_LINE' | 'SENSOR';

export interface BiosystemNode {
  id: string;
  type: BiosystemNodeType;
  properties: {
    capacityGallons?: number;
    flowRateGpm?: number;
    targetPh?: number;
    monitoredMetric?: 'PH' | 'LEVEL' | 'FLOW';
  };
  edges: string[];
}

export interface BiosystemSuggestionEvent {
  id: string;
  ts: string;
  suggestion_id: string;
  component_type: string;
  action: 'accepted' | 'dismissed';
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface NetworkVisionIdea {
  id: string;
  ts: string;
  category: 'water' | 'sensor_data' | 'labor';
  title: string;
  prompt: string;
}

export interface BiosystemLoopManifest {
  manifestId: string;
  roomRegistryId: string;
  title: string;
  targetPh: number;
  reservoirCapacityGallons: number;
  pumpFlowRateGpm: number;
  returnPathEnabled: boolean;
  sensorEnabled: boolean;
  nodes: Record<string, BiosystemNode>;
  suggestionHistory: BiosystemSuggestionEvent[];
  networkIdeas: NetworkVisionIdea[];
  updatedAt: string;
}

interface BiosystemLoopCanvasProps {
  onUpdate?: (payload: BiosystemLoopManifest | null) => void;
  onValidate?: (report: ValidationReport) => void;
}

export default function BiosystemLoopCanvas({ onUpdate, onValidate }: BiosystemLoopCanvasProps) {
  const [title] = useState('Aquaculture Loop Draft');
  const [targetPh, setTargetPh] = useState(6.9);
  const [reservoirCapacityGallons, setReservoirCapacityGallons] = useState(500);
  const [pumpFlowRateGpm, setPumpFlowRateGpm] = useState(12);
  const [returnPathEnabled, setReturnPathEnabled] = useState(true);
  const [sensorEnabled, setSensorEnabled] = useState(true);

  // Position state for draggable nodes
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({
    RESERVOIR: { x: 50, y: 150 },
    PUMP: { x: 250, y: 150 },
    GROW_BED: { x: 450, y: 150 },
    SENSOR: { x: 650, y: 150 },
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<string, number>>({});
  const [suggestionHistory, setSuggestionHistory] = useState<BiosystemSuggestionEvent[]>([]);
  const [networkIdeas, setNetworkIdeas] = useState<NetworkVisionIdea[]>([]);
  const [networkView, setNetworkView] = useState(false);
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const networkIdeaTemplates: Array<Omit<NetworkVisionIdea, 'id' | 'ts'>> = [
    {
      category: 'water',
      title: 'Shared Water Reserve',
      prompt: 'What if this facility shared its water with yours?',
    },
    {
      category: 'sensor_data',
      title: 'Shared Monitoring Hub',
      prompt: 'What if sensor data from both loops informed a central planning hub?',
    },
    {
      category: 'labor',
      title: 'Seasonal Labor Exchange',
      prompt: 'What if labor moved between facilities based on seasonal demand?',
    },
  ];

  const activeSuggestions = useMemo(() => {
    const now = Date.now();
    const activeDismissals = Object.keys(dismissedSuggestions).filter(id => now - dismissedSuggestions[id] < 30000);
    return generateSuggestions({
      targetPh,
      reservoirCapacityGallons,
      pumpFlowRateGpm,
      returnPathEnabled,
      sensorEnabled
    }, activeDismissals);
  }, [targetPh, reservoirCapacityGallons, pumpFlowRateGpm, returnPathEnabled, sensorEnabled, dismissedSuggestions]);

  const handleAcceptSuggestion = (s: BiosystemSuggestion) => {
    console.log(`operator_accepted_ai_suggestion: ${s.componentType}`);
    if (s.componentType === 'RETURN_LINE') setReturnPathEnabled(true);
    if (s.componentType === 'SENSOR') setSensorEnabled(true);
    if (s.componentType === 'RESERVOIR_CAPACITY') setReservoirCapacityGallons(prev => Math.max(prev, pumpFlowRateGpm * 25));
    if (s.componentType === 'BUFFER_RESERVOIR') console.log('operator_accepted_ai_suggestion: BUFFER_RESERVOIR'); // Visual only for now
    setDismissedSuggestions(prev => ({ ...prev, [s.id]: Date.now() }));
    
    setSuggestionHistory(prev => {
      const event: BiosystemSuggestionEvent = {
        id: `ev_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        ts: new Date().toISOString(),
        suggestion_id: s.id,
        component_type: s.componentType || 'unknown',
        action: 'accepted',
        reasoning: s.reasoning,
        confidence: s.confidence
      };
      return [event, ...prev].slice(0, 10);
    });
  };

  const handleDismissSuggestion = (id: string, s?: BiosystemSuggestion) => {
    console.log(`operator_dismissed_ai_suggestion: ${id}`);
    setDismissedSuggestions(prev => ({ ...prev, [id]: Date.now() }));
    
    if (s) {
      setSuggestionHistory(prev => {
        const event: BiosystemSuggestionEvent = {
          id: `ev_${Date.now()}_${Math.floor(Math.random()*1000)}`,
          ts: new Date().toISOString(),
          suggestion_id: s.id,
          component_type: s.componentType || 'unknown',
          action: 'dismissed',
          reasoning: s.reasoning,
          confidence: s.confidence
        };
        return [event, ...prev].slice(0, 10);
      });
    }
  };

  const saveNetworkIdeas = () => {
    setNetworkIdeas(prev => {
      const existingPrompts = new Set(prev.map(idea => idea.prompt));
      const nextIdeas = networkIdeaTemplates
        .filter(template => !existingPrompts.has(template.prompt))
        .map(template => ({
          ...template,
          id: `net_${Date.now()}_${template.category}`,
          ts: new Date().toISOString(),
        }));

      if (nextIdeas.length === 0) {
        return prev;
      }

      return [...nextIdeas, ...prev].slice(0, 6);
    });
    setShowNetworkModal(false);
  };

  const handlePointerDown = (e: React.PointerEvent, nodeId: string) => {
    setDraggingNode(nodeId);
    setSelectedNode(nodeId);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingNode || !svgRef.current) return;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    
    // Very simple drag: just update based on movement dx/dy
    setPositions(prev => ({
      ...prev,
      [draggingNode]: {
        x: prev[draggingNode].x + e.movementX / CTM.a,
        y: prev[draggingNode].y + e.movementY / CTM.d
      }
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDraggingNode(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  // Build manifest matching old logic
  const manifest = useMemo(() => {
    const nodes: Record<string, BiosystemNode> = {
      reservoir_01: {
        id: 'reservoir_01',
        type: 'RESERVOIR',
        properties: { capacityGallons: reservoirCapacityGallons, targetPh },
        edges: ['pump_01'],
      },
      pump_01: {
        id: 'pump_01',
        type: 'PUMP',
        properties: { flowRateGpm: pumpFlowRateGpm },
        edges: ['grow_bed_01'],
      },
      grow_bed_01: {
        id: 'grow_bed_01',
        type: 'GROW_BED',
        properties: { targetPh },
        edges: sensorEnabled ? ['sensor_01'] : returnPathEnabled ? ['return_line_01'] : [],
      },
    };

    if (sensorEnabled) {
      nodes.sensor_01 = {
        id: 'sensor_01',
        type: 'SENSOR',
        properties: { monitoredMetric: 'PH' },
        edges: returnPathEnabled ? ['return_line_01'] : [],
      };
    }
    if (returnPathEnabled) {
      nodes.return_line_01 = {
        id: 'return_line_01',
        type: 'RETURN_LINE',
        properties: {},
        edges: ['reservoir_01'],
      };
    }

    return {
      manifestId: 'biosystem-loop-mvp',
      roomRegistryId: 'local-workbench-biosystem',
      title,
      targetPh,
      reservoirCapacityGallons,
      pumpFlowRateGpm,
      returnPathEnabled,
      sensorEnabled,
      nodes,
      suggestionHistory,
      networkIdeas,
      updatedAt: new Date().toISOString(),
    };
  }, [title, targetPh, reservoirCapacityGallons, pumpFlowRateGpm, returnPathEnabled, sensorEnabled, suggestionHistory, networkIdeas]);

  const report = useMemo<ValidationReport>(() => {
    const results: ValidationReport['results'] = [];
    if (!returnPathEnabled) {
      results.push({ level: 'warning', message: 'Return path is missing. Fluid loop does not resolve back to the reservoir.' });
    }
    if (!sensorEnabled) {
      results.push({ level: 'warning', message: 'Critical pH sensor is not present on the loop.' });
    }
    if (targetPh < 6.5 || targetPh > 7.8) {
      results.push({ level: 'warning', message: `Target pH ${targetPh.toFixed(1)} is outside the recommended 6.5 to 7.8 band.` });
    }
    if (targetPh > 8.5 || targetPh < 4.6) {
      results.push({ level: 'hard_fail', message: `Target pH ${targetPh.toFixed(1)} exceeds the fail-closed safety boundary for this draft.` });
    }
    if (pumpFlowRateGpm > reservoirCapacityGallons / 20) {
      results.push({ level: 'warning', message: 'Pump flow rate may overload the current reservoir volume estimate.' });
    }

    const hasHardFail = results.some((item) => item.level === 'hard_fail');
    const hasWarning = results.some((item) => item.level === 'warning');
    return {
      isValid: !hasHardFail,
      level: hasHardFail ? 'hard_fail' : hasWarning ? 'warning' : 'ok',
      results,
    };
  }, [pumpFlowRateGpm, reservoirCapacityGallons, returnPathEnabled, sensorEnabled, targetPh]);

  useEffect(() => {
    onUpdate?.(manifest);
    onValidate?.(report);
  }, [manifest, onUpdate, onValidate, report]);

  const loopStatus = useMemo(() => {
    if (targetPh > 8.5 || targetPh < 4.6) return { text: "BLOCKED — pH exceeds fail-closed safety boundary", color: "#ef4444" };
    if (targetPh < 6.5 || targetPh > 7.8) return { text: "WARNING — pH outside recommended band", color: "#f59e0b" };
    if (pumpFlowRateGpm > reservoirCapacityGallons / 20) return { text: "WARNING — pump flow rate may overload reservoir", color: "#f59e0b" };
    if (!sensorEnabled && !returnPathEnabled) return { text: "INCOMPLETE — missing sensor and return path", color: "#ef4444" };
    if (!returnPathEnabled) return { text: "INCOMPLETE — missing return path", color: "#ef4444" };
    if (!sensorEnabled) return { text: "INCOMPLETE — missing sensor", color: "#ef4444" };
    return { text: "COMPLETE — all configured components present", color: "#10b981" };
  }, [targetPh, pumpFlowRateGpm, reservoirCapacityGallons, sensorEnabled, returnPathEnabled]);

  // Derived styling helpers
  const phColor = targetPh > 8.5 || targetPh < 4.6 ? '#ef4444' : targetPh < 6.5 || targetPh > 7.8 ? '#f59e0b' : '#34D399';
  const pumpMismatch = pumpFlowRateGpm > reservoirCapacityGallons / 20;
  
  // Connection drawing logic
  const drawLine = (start: { x: number; y: number }, end: { x: number; y: number }, active: boolean) => (
    <path
      d={`M ${start.x} ${start.y} C ${start.x + 50} ${start.y}, ${end.x - 50} ${end.y}, ${end.x} ${end.y}`}
      fill="none"
      strokeWidth="3"
      className={`transition-colors duration-300 ${active ? arrowClass : 'flow-missing'}`}
      markerEnd={active ? "url(#arrow-active)" : "url(#arrow-dim)"}
    />
  );

  // Animation classes dependent on state
  const isHealthy = targetPh >= 6.5 && targetPh <= 7.8 && !pumpMismatch && returnPathEnabled && sensorEnabled;
  const isWarning = (targetPh < 6.5 && targetPh > 4.6) || (targetPh > 7.8 && targetPh < 8.5) || pumpMismatch || !returnPathEnabled || !sensorEnabled;
  const isFail = targetPh >= 8.5 || targetPh <= 4.6;

  const canvasBgClass = draggingNode ? '' : networkView ? 'ambient-network' : isFail ? 'ambient-fail' : isHealthy ? 'ambient-healthy' : '';
  const arrowClass = draggingNode ? '' : isFail ? 'flow-fail' : isWarning ? 'flow-warning' : 'flow-healthy';
  const pumpClass = draggingNode ? '' : pumpMismatch ? 'pump-overloaded' : 'pump-active';
  const bedClass = draggingNode ? '' : isHealthy ? 'bed-optimal' : '';
  const resWaveClass = draggingNode ? '' : isFail ? 'wave-fail' : isWarning ? 'wave-warning' : 'wave-healthy';

  return (
    <div className={`flex flex-col gap-4 text-sm font-mono h-[600px] border border-[#2A1F16] rounded-xl overflow-hidden transition-colors duration-700 bg-[#050302] ${canvasBgClass}`}>
      {/* Toolbar / Palette */}
      <div className="bg-black/60 border-b border-[#2A1F16] p-3 flex flex-wrap items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="text-[10px] uppercase tracking-widest text-[#4A90D9] font-bold">Biosystem Canvas</div>
          <button 
            onClick={() => setNetworkView(!networkView)}
            className={`px-3 py-1 text-[9px] uppercase tracking-widest font-bold rounded border transition-colors ${networkView ? 'bg-[#4A90D9]/20 border-[#4A90D9] text-[#4A90D9]' : 'bg-black/40 border-[#2A1F16] text-gray-500 hover:border-gray-500 hover:text-gray-300'}`}
          >
            {networkView ? 'Hide Network View' : 'Show Network View'}
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => setSensorEnabled(!sensorEnabled)}
              className={`px-3 py-1.5 text-[9px] uppercase tracking-widest rounded border transition-colors ${sensorEnabled ? 'bg-[#FBBF24]/20 border-[#FBBF24]/40 text-[#FBBF24]' : 'bg-white/5 border-white/10 text-gray-500'}`}
            >
              Sensor
            </button>
            <button 
              onClick={() => setReturnPathEnabled(!returnPathEnabled)}
              className={`px-3 py-1.5 text-[9px] uppercase tracking-widest rounded border transition-colors ${returnPathEnabled ? 'bg-[#4A90D9]/20 border-[#4A90D9]/40 text-[#4A90D9]' : 'bg-white/5 border-white/10 text-gray-500'}`}
            >
              Return Path
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: loopStatus.color }}>
            {loopStatus.text}
          </div>
          <div className="flex flex-col gap-1 items-end">
            <div className="text-[9px] uppercase tracking-widest text-gray-500 px-2 py-1 rounded bg-black/40 border border-[#2A1F16]">
              Interactive planning canvas. Not a live simulation.
            </div>
            <div className="text-[8px] uppercase tracking-widest text-gray-600">
              Ambient vitality indicators. Not live sensor data.
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        <div className="flex flex-col gap-4 absolute left-4 top-4 z-20">
          <SuggestionPanel 
            suggestions={activeSuggestions} 
            onAccept={handleAcceptSuggestion} 
            onDismiss={(id) => handleDismissSuggestion(id, activeSuggestions.find(s => s.id === id))} 
          />
        </div>

        {suggestionHistory.length > 0 && (
          <details className="absolute left-4 bottom-4 z-20 w-80 bg-[#0A0604]/90 border border-[#2A1F16] rounded-md shadow-xl backdrop-blur-sm text-[10px] text-gray-400 group cursor-pointer">
            <summary className="px-3 py-2 uppercase tracking-widest text-[#a9bfd6] font-bold outline-none flex items-center justify-between hover:bg-white/5 transition-colors">
              Decision Trace <span className="text-[8px] text-gray-600 font-normal">({suggestionHistory.length} events)</span>
            </summary>
            <div className="px-3 pb-3 border-t border-[#2A1F16]/50 pt-2 flex flex-col gap-1.5 cursor-default">
              {suggestionHistory.slice(0, 3).map(ev => (
                <div key={ev.id} className="font-mono text-[9px] opacity-80">
                  AI proposed {ev.component_type}. Human {ev.action}.
                </div>
              ))}
              <div className="text-[8px] text-gray-600 uppercase tracking-widest mt-1 pt-2 border-t border-[#2A1F16]/50">
                Local suggestion trace. Documents client-side options presented to the operator prior to manual layout promotion.
              </div>
            </div>
          </details>
        )}

        {networkIdeas.length > 0 && (
          <details className="absolute right-4 bottom-4 z-20 w-80 bg-[#0A0604]/90 border border-[#2A1F16] rounded-md shadow-xl backdrop-blur-sm text-[10px] text-gray-400 group cursor-pointer">
            <summary className="px-3 py-2 uppercase tracking-widest text-[#8fb5dd] font-bold outline-none flex items-center justify-between hover:bg-white/5 transition-colors">
              Network Vision Seeds <span className="text-[8px] text-gray-600 font-normal">({networkIdeas.length} local ideas)</span>
            </summary>
            <div className="px-3 pb-3 border-t border-[#2A1F16]/50 pt-2 flex flex-col gap-2 cursor-default">
              {networkIdeas.slice(0, 3).map(idea => (
                <div key={idea.id} className="font-mono text-[9px] opacity-80">
                  <div className="text-[#8fb5dd] uppercase tracking-widest">{idea.title}</div>
                  <div>{idea.prompt}</div>
                </div>
              ))}
              <div className="text-[8px] text-gray-600 uppercase tracking-widest mt-1 pt-2 border-t border-[#2A1F16]/50">
                Local network ideas. Vision only. Not implemented or scheduled.
              </div>
            </div>
          </details>
        )}

        {networkView && <NetworkSuggestionPanel onClose={() => setNetworkView(false)} />}
        
        {showNetworkModal && (
          <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#0A0604] border border-[#4A90D9] rounded-lg max-w-md p-6 font-mono text-sm shadow-2xl">
              <h3 className="text-[#4A90D9] font-bold uppercase tracking-widest mb-4">What If? (Ideas)</h3>
              <ul className="text-gray-300 flex flex-col gap-3 mb-6">
                <li className="bg-[#4A90D9]/10 p-2 border-l-2 border-[#4A90D9]">What if this facility shared its water with yours?</li>
                <li className="bg-[#34D399]/10 p-2 border-l-2 border-[#34D399]">What if sensor data from both loops informed a central planning hub?</li>
                <li className="bg-[#E8842A]/10 p-2 border-l-2 border-[#E8842A]">What if labor moved between facilities based on seasonal demand?</li>
              </ul>
              <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-6">
                These are questions, not features. Provokes thought, not action.
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowNetworkModal(false)} className="px-4 py-2 border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 rounded transition-colors text-[10px] uppercase tracking-widest">Close</button>
                <button onClick={saveNetworkIdeas} className="px-4 py-2 bg-[#4A90D9]/20 border border-[#4A90D9] text-[#4A90D9] hover:bg-[#4A90D9]/30 rounded transition-colors text-[10px] uppercase tracking-widest font-bold">Save to Ideas</button>
              </div>
            </div>
          </div>
        )}
        
        <svg 
          ref={svgRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <defs>
            <marker id="arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4A90D9" />
            </marker>
            <marker id="arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
            </marker>
          </defs>
          
          <style>{`
            @keyframes pulseOpacity { 0% { opacity: 0.3; } 50% { opacity: 0.7; } 100% { opacity: 0.3; } }
            .ghost-pulse { animation: pulseOpacity 2s infinite ease-in-out; }
            .ghost-element { stroke-dasharray: 4,4; fill: transparent; stroke: #4A90D9; }
            
            /* Ambient Canvas */
            @keyframes ambientHealthy { 0% { background-color: #050302; } 50% { background-color: #040906; } 100% { background-color: #050302; } }
            @keyframes ambientFail { 0% { background-color: #050302; } 50% { background-color: #1a0505; } 100% { background-color: #050302; } }
            @keyframes ambientNetwork { 0% { background-color: #050302; } 50% { background-color: #081115; } 100% { background-color: #050302; } }
            .ambient-healthy { animation: ambientHealthy 8s infinite ease-in-out; }
            .ambient-fail { animation: ambientFail 2s infinite ease-in-out; }
            .ambient-network { animation: ambientNetwork 8s infinite ease-in-out; }
            
            /* Flow Arrows */
            @keyframes flowMove { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
            @keyframes flowNetwork { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } }
            .flow-healthy { stroke-dasharray: 8,4; animation: flowMove 3s linear infinite; stroke: #4A90D9; }
            .flow-warning { stroke-dasharray: 8,4; animation: flowMove 1.5s linear infinite; stroke: #f59e0b; }
            .flow-fail { stroke-dasharray: 4,8; animation: flowMove 0.5s steps(2) infinite; stroke: #ef4444; }
            .flow-missing { stroke-dasharray: 5,5; stroke: #374151; }
            .flow-network { stroke-dasharray: 10,10; animation: flowNetwork 4s linear infinite; stroke: #8fb5dd; }
            
            /* Ghost Network Pulse */
            @keyframes ghostPulse { 0% { opacity: 0.15; } 50% { opacity: 0.25; } 100% { opacity: 0.15; } }
            .network-ghost-group { animation: ghostPulse 8s infinite ease-in-out; cursor: pointer; transition: opacity 0.5s ease-in-out; }
            .network-ghost-group:hover { opacity: 0.4 !important; }
            
            /* Pump Heartbeat */
            @keyframes pumpActive { 0% { transform: scale(1); box-shadow: 0 0 0px #4A90D9; } 50% { transform: scale(1.05); box-shadow: 0 0 15px #4A90D9; } 100% { transform: scale(1); box-shadow: 0 0 0px #4A90D9; } }
            @keyframes pumpOverload { 0% { transform: scale(1); box-shadow: 0 0 0px #f59e0b; } 50% { transform: scale(1.08); box-shadow: 0 0 20px #f59e0b; } 100% { transform: scale(1); box-shadow: 0 0 0px #f59e0b; } }
            .pump-active circle:first-child { animation: pumpActive 2s infinite ease-in-out; transform-origin: center; }
            .pump-overloaded circle:first-child { animation: pumpOverload 0.8s infinite ease-in-out; transform-origin: center; }
            
            /* Grow Bed Shimmer */
            @keyframes bedOptimal { 0% { opacity: 0.9; filter: drop-shadow(0 0 2px #34D399); } 50% { opacity: 1; filter: drop-shadow(0 0 12px #34D399); } 100% { opacity: 0.9; filter: drop-shadow(0 0 2px #34D399); } }
            .bed-optimal rect { animation: bedOptimal 4s infinite ease-in-out; }
            
            /* Reservoir Wave */
            @keyframes waveHealthy { 0% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-2px) scaleY(1.05); } 100% { transform: translateY(0) scaleY(1); } }
            @keyframes waveWarning { 0% { transform: translateY(0) skewX(0); } 25% { transform: translateY(-3px) skewX(2deg); } 75% { transform: translateY(1px) skewX(-2deg); } 100% { transform: translateY(0) skewX(0); } }
            @keyframes waveFail { 0% { transform: translateY(0) skewX(0); } 25% { transform: translateY(-5px) skewX(5deg); } 75% { transform: translateY(3px) skewX(-5deg); } 100% { transform: translateY(0) skewX(0); } }
            .wave-healthy rect:nth-child(2) { animation: waveHealthy 3s infinite ease-in-out; transform-origin: bottom; }
            .wave-warning rect:nth-child(2) { animation: waveWarning 1.5s infinite ease-in-out; transform-origin: bottom; }
            .wave-fail rect:nth-child(2) { animation: waveFail 0.5s infinite linear; transform-origin: bottom; }
          `}</style>

          {/* Lines */}
          {drawLine({ x: positions.RESERVOIR.x + 60, y: positions.RESERVOIR.y }, { x: positions.PUMP.x - 50, y: positions.PUMP.y }, true)}
          {drawLine({ x: positions.PUMP.x + 50, y: positions.PUMP.y }, { x: positions.GROW_BED.x - 60, y: positions.GROW_BED.y }, true)}
          
          {sensorEnabled && drawLine({ x: positions.GROW_BED.x + 60, y: positions.GROW_BED.y }, { x: positions.SENSOR.x - 40, y: positions.SENSOR.y }, true)}
          
          {returnPathEnabled && sensorEnabled && drawLine({ x: positions.SENSOR.x + 40, y: positions.SENSOR.y }, { x: positions.RESERVOIR.x, y: positions.RESERVOIR.y - 40 }, true)}
          {returnPathEnabled && !sensorEnabled && drawLine({ x: positions.GROW_BED.x + 60, y: positions.GROW_BED.y }, { x: positions.RESERVOIR.x, y: positions.RESERVOIR.y - 40 }, true)}
          
          {!returnPathEnabled && (
            <g>
               <text x={positions.GROW_BED.x + 100} y={positions.GROW_BED.y - 20} fill="#ef4444" fontSize="10" className="font-bold">MISSING RETURN</text>
               {activeSuggestions.some(s => s.id === 'sugg_return_path') && (
                 <g className="ghost-pulse cursor-pointer" onClick={() => handleAcceptSuggestion(activeSuggestions.find(s => s.id === 'sugg_return_path')!)}>
                   <path d={`M ${positions.GROW_BED.x + 60} ${positions.GROW_BED.y} C ${positions.GROW_BED.x + 100} ${positions.GROW_BED.y}, ${positions.RESERVOIR.x - 50} ${positions.RESERVOIR.y - 40}, ${positions.RESERVOIR.x} ${positions.RESERVOIR.y - 40}`} fill="none" stroke="#4A90D9" strokeWidth="2" className="ghost-element" />
                   <text x={(positions.GROW_BED.x + positions.RESERVOIR.x) / 2} y={positions.GROW_BED.y - 40} fill="#4A90D9" fontSize="9" fontStyle="italic">AI SUGGESTION: Return Line</text>
                 </g>
               )}
            </g>
          )}

          {/* NETWORK VIEW GHOST LOOP */}
          {networkView && (
            <g className="network-ghost-group" transform="translate(180, 220) scale(0.7)" onClick={() => setShowNetworkModal(true)}>
              {/* Network connection line */}
              <path d="M -180 -220 C -50 -100, -50 0, 50 150" fill="none" strokeWidth="3" className="flow-network" markerEnd="url(#arrow-dim)" />
              <text x="-50" y="-50" fill="#8fb5dd" fontSize="12" fontStyle="italic" fontWeight="bold">POTENTIAL RESOURCE SHARING</text>
              <text x="-50" y="-35" fill="#8fb5dd" fontSize="10">💧 water ➔</text>
              <text x="-50" y="-20" fill="#34D399" fontSize="10">🌱 nutrients ➔</text>
              
              <text x="350" y="50" fill="#4A90D9" fontSize="24" fontWeight="bold" opacity="0.6">POTENTIAL LOOP</text>
              <text x="350" y="80" fill="#a9bfd6" fontSize="12" opacity="0.6">Potential facility. Not configured. Not real.</text>
              
              {/* Ghost Reservoir */}
              <g transform={`translate(${positions.RESERVOIR.x}, ${positions.RESERVOIR.y})`}>
                <rect x="-60" y="-40" width="120" height="80" rx="8" fill="transparent" stroke="#4A90D9" strokeWidth="2" strokeDasharray="6,6" />
                <text x="0" y="-10" fill="#4A90D9" fontSize="12" textAnchor="middle" fontWeight="bold">SHARED RESERVOIR</text>
                <text x="0" y="10" fill="#4A90D9" fontSize="10" textAnchor="middle">1000 gal (central)</text>
              </g>
              
              {/* Ghost Pump */}
              <g transform={`translate(${positions.PUMP.x}, ${positions.PUMP.y})`}>
                <circle cx="0" cy="0" r="40" fill="transparent" stroke="#E8842A" strokeWidth="2" strokeDasharray="6,6" />
                <text x="0" y="-5" fill="#E8842A" fontSize="12" textAnchor="middle" fontWeight="bold">CENTRAL PUMP</text>
                <text x="0" y="12" fill="#E8842A" fontSize="10" textAnchor="middle">30 GPM</text>
              </g>
              
              {/* Ghost Grow Bed */}
              <g transform={`translate(${positions.GROW_BED.x}, ${positions.GROW_BED.y})`}>
                <rect x="-60" y="-30" width="120" height="60" rx="4" fill="transparent" stroke="#34D399" strokeWidth="2" strokeDasharray="6,6" />
                <text x="0" y="5" fill="#34D399" fontSize="12" textAnchor="middle" fontWeight="bold">COMMUNITY CLUSTER</text>
              </g>
              
              {/* Ghost Sensor */}
              <g transform={`translate(${positions.SENSOR.x}, ${positions.SENSOR.y})`}>
                <rect x="-30" y="-30" width="60" height="60" rx="4" fill="transparent" stroke="#FBBF24" strokeWidth="2" strokeDasharray="6,6" />
                <text x="0" y="5" fill="#FBBF24" fontSize="10" textAnchor="middle" fontWeight="bold">MONITORING</text>
              </g>
              
              {/* Ghost lines */}
              <path d={`M ${positions.RESERVOIR.x + 60} ${positions.RESERVOIR.y} C ${positions.RESERVOIR.x + 110} ${positions.RESERVOIR.y}, ${positions.PUMP.x - 50} ${positions.PUMP.y}, ${positions.PUMP.x} ${positions.PUMP.y}`} fill="none" strokeWidth="2" stroke="#4A90D9" strokeDasharray="4,4" />
              <path d={`M ${positions.PUMP.x + 50} ${positions.PUMP.y} C ${positions.PUMP.x + 100} ${positions.PUMP.y}, ${positions.GROW_BED.x - 60} ${positions.GROW_BED.y}, ${positions.GROW_BED.x} ${positions.GROW_BED.y}`} fill="none" strokeWidth="2" stroke="#4A90D9" strokeDasharray="4,4" />
              <path d={`M ${positions.GROW_BED.x + 60} ${positions.GROW_BED.y} C ${positions.GROW_BED.x + 100} ${positions.GROW_BED.y}, ${positions.SENSOR.x - 40} ${positions.SENSOR.y}, ${positions.SENSOR.x} ${positions.SENSOR.y}`} fill="none" strokeWidth="2" stroke="#4A90D9" strokeDasharray="4,4" />
            </g>
          )}
          
          {/* RESERVOIR */}
          <g 
            transform={`translate(${positions.RESERVOIR.x}, ${positions.RESERVOIR.y})`}
            onPointerDown={(e) => handlePointerDown(e, 'RESERVOIR')}
            className={`cursor-pointer ${resWaveClass}`}
          >
            <rect x="-60" y="-40" width="120" height="80" rx="8" fill="#0A0604" stroke={selectedNode === 'RESERVOIR' ? '#FAF6EF' : '#4A90D9'} strokeWidth="2" />
            <rect x="-60" y="0" width="120" height="40" rx="8" fill={phColor} opacity={targetPh > 8.5 || targetPh < 4.6 ? 0.6 : 0.2} className="transition-all duration-300" />
            <text x="0" y="-10" fill="#4A90D9" fontSize="12" textAnchor="middle" fontWeight="bold">RESERVOIR</text>
            <text x="0" y="10" fill="#a9bfd6" fontSize="10" textAnchor="middle">{reservoirCapacityGallons} gal</text>
            <text x="0" y="25" fill={phColor} fontSize="10" textAnchor="middle">pH: {targetPh.toFixed(1)}</text>
            <text x="0" y="35" fill="rgba(255,255,255,0.2)" fontSize="6" textAnchor="middle">Wave shape indicates pH health</text>
            
            {activeSuggestions.some(s => s.id === 'sugg_buffer_reservoir') && (
              <g className="ghost-pulse cursor-pointer" transform="translate(0, -60)" onClick={() => handleAcceptSuggestion(activeSuggestions.find(s => s.id === 'sugg_buffer_reservoir')!)}>
                <rect x="-40" y="-30" width="80" height="60" rx="4" className="ghost-element" />
                <text x="0" y="-10" fill="#4A90D9" fontSize="9" fontStyle="italic" textAnchor="middle">AI SUGGESTION:</text>
                <text x="0" y="0" fill="#4A90D9" fontSize="9" fontStyle="italic" textAnchor="middle">Buffer Res</text>
                <text x="0" y="15" fill="#4A90D9" fontSize="6" fontStyle="italic" textAnchor="middle">(Visual Only)</text>
              </g>
            )}
          </g>

          {/* PUMP */}
          <g 
            transform={`translate(${positions.PUMP.x}, ${positions.PUMP.y})`}
            onPointerDown={(e) => handlePointerDown(e, 'PUMP')}
            className={`cursor-pointer ${pumpClass}`}
          >
            <circle cx="0" cy="0" r="40" fill="#0A0604" stroke={selectedNode === 'PUMP' ? '#FAF6EF' : pumpMismatch ? '#f59e0b' : '#E8842A'} strokeWidth="2" />
            {activeSuggestions.some(s => s.id === 'sugg_pump_mismatch') && (
              <circle cx="0" cy="0" r="46" className="ghost-element ghost-pulse cursor-pointer" stroke="#f59e0b" onClick={() => handleAcceptSuggestion(activeSuggestions.find(s => s.id === 'sugg_pump_mismatch')!)} />
            )}
            <text x="0" y="-5" fill={pumpMismatch ? '#f59e0b' : '#E8842A'} fontSize="12" textAnchor="middle" fontWeight="bold">PUMP</text>
            <text x="0" y="12" fill="#d2c5b8" fontSize="10" textAnchor="middle">{pumpFlowRateGpm} GPM</text>
            <text x="0" y="22" fill="rgba(255,255,255,0.2)" fontSize="6" textAnchor="middle">Pulse = status</text>
          </g>

          {/* GROW BED */}
          <g 
            transform={`translate(${positions.GROW_BED.x}, ${positions.GROW_BED.y})`}
            onPointerDown={(e) => handlePointerDown(e, 'GROW_BED')}
            className={`cursor-pointer ${bedClass}`}
          >
            <rect x="-60" y="-30" width="120" height="60" rx="4" fill="#0A0604" stroke={selectedNode === 'GROW_BED' ? '#FAF6EF' : '#34D399'} strokeWidth="2" />
            <text x="0" y="5" fill="#34D399" fontSize="12" textAnchor="middle" fontWeight="bold">GROW BED</text>
            <text x="0" y="18" fill="rgba(255,255,255,0.2)" fontSize="6" textAnchor="middle">Shimmer = optimal</text>
          </g>

          {/* SENSOR */}
          {sensorEnabled ? (
            <g 
              transform={`translate(${positions.SENSOR.x}, ${positions.SENSOR.y})`}
              onPointerDown={(e) => handlePointerDown(e, 'SENSOR')}
              className="cursor-pointer"
            >
              <rect x="-30" y="-30" width="60" height="60" rx="4" fill="#0A0604" stroke={selectedNode === 'SENSOR' ? '#FAF6EF' : '#FBBF24'} strokeWidth="2" />
              <text x="0" y="5" fill="#FBBF24" fontSize="10" textAnchor="middle" fontWeight="bold">SENSOR</text>
            </g>
          ) : (
            <g transform={`translate(${positions.SENSOR.x}, ${positions.SENSOR.y})`} className="opacity-30 cursor-pointer" onClick={() => setSensorEnabled(true)}>
              <rect x="-30" y="-30" width="60" height="60" rx="4" fill="transparent" stroke="#6b7280" strokeWidth="2" strokeDasharray="4,4" />
              <text x="0" y="5" fill="#6b7280" fontSize="9" textAnchor="middle">CLICK TO ADD</text>
              {activeSuggestions.some(s => s.id === 'sugg_sensor') && (
                <g className="ghost-pulse" transform="translate(0, -40)" onClick={(e) => { e.stopPropagation(); handleAcceptSuggestion(activeSuggestions.find(s => s.id === 'sugg_sensor')!); }}>
                  <rect x="-35" y="-20" width="70" height="30" rx="4" className="ghost-element" />
                  <text x="0" y="-5" fill="#4A90D9" fontSize="8" fontStyle="italic" textAnchor="middle">AI SUGGESTION:</text>
                  <text x="0" y="5" fill="#4A90D9" fontSize="8" fontStyle="italic" textAnchor="middle">pH Sensor</text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* Floating Controls Overlay */}
        {selectedNode && (
          <div className={`absolute top-4 right-4 ${selectedNode === 'RESERVOIR' ? 'w-[560px]' : 'w-64'} bg-black/95 border border-[#2A1F16] rounded-xl shadow-2xl z-20 backdrop-blur-md overflow-hidden flex flex-col`}>
            {selectedNode === 'RESERVOIR' ? (
              <>
                <div className="flex bg-[#0A0604] border-b border-[#2A1F16]">
                  <div className="w-1/2 p-3 text-[10px] uppercase tracking-widest text-[#FAF6EF] font-bold border-r border-[#2A1F16] flex justify-between items-center">
                    <span>HUMAN BRIEF</span>
                  </div>
                  <div className="w-1/2 p-3 text-[10px] uppercase tracking-widest text-[#60A5FA] font-bold flex justify-between items-center">
                    <span>MACHINE SPEC (JSON-LD)</span>
                    <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white transition-colors">&times;</button>
                  </div>
                </div>
                <div className="flex">
                  {/* Left Pane */}
                  <div className="w-1/2 p-5 border-r border-[#2A1F16] flex flex-col gap-6">
                    <div>
                      <div className="text-2xl font-bold text-[#34D399] tracking-tight">
                        {reservoirCapacityGallons.toLocaleString()} <span className="text-[10px] text-[#34D399]/70 uppercase tracking-widest align-middle">Gallons</span>
                      </div>
                      <div className="text-[11px] text-[#a08c72] mt-2 leading-relaxed">
                        Allocated capacity parameter. Adjust the baseline volume constraint to simulate resource flow.
                      </div>
                    </div>
                    
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-widest text-gray-400">
                      Capacity Slider
                      <input 
                        type="range" min="50" max="2000" step="50" 
                        value={reservoirCapacityGallons} 
                        onChange={e => setReservoirCapacityGallons(Number(e.target.value))} 
                        className="accent-[#34D399]"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-[10px] uppercase tracking-widest text-gray-400">
                      Target pH ({targetPh.toFixed(1)})
                      <input 
                        type="range" min="4" max="9" step="0.1" 
                        value={targetPh} 
                        onChange={e => setTargetPh(Number(e.target.value))} 
                        className="accent-[#34D399]"
                      />
                    </label>
                  </div>
                  
                  {/* Right Pane */}
                  <div className="w-1/2 bg-[#050302] p-0 flex flex-col relative">
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#34D399]/10 text-[#34D399] px-2 py-1 rounded text-[9px] uppercase tracking-widest font-bold border border-[#34D399]/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] animate-pulse"></div>
                      VALID
                    </div>
                    <div className="p-5 flex-1 overflow-x-auto text-[10px] text-gray-300 font-mono whitespace-pre selection:bg-[#60A5FA]/30 pt-10">
                      {JSON.stringify(manifest.nodes['reservoir_01'], null, 2)}
                    </div>
                  </div>
                </div>
                {/* Handshake Handoff Footer */}
                <div className="bg-[#0A0604] border-t border-[#2A1F16] p-3 text-center">
                  <button 
                    onClick={() => {
                      if (onUpdate) onUpdate(manifest);
                    }}
                    className="text-[10px] uppercase tracking-widest text-[#D4A853] hover:text-white font-bold transition-colors"
                  >
                    🚀 [PROJECT BLUEPRINT TO SPATIAL MAP]
                  </button>
                </div>
              </>
            ) : (
              // Default view for other nodes
              <div className="p-4">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-[#2A1F16]">
                  <div className="text-[10px] uppercase tracking-widest text-[#FAF6EF] font-bold">{selectedNode} Config</div>
                  <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white">&times;</button>
                </div>
                
                <div className="flex flex-col gap-4">
                  {selectedNode === 'PUMP' && (
                    <label className="flex flex-col gap-1 text-[10px] uppercase tracking-widest text-gray-400">
                      Flow Rate (GPM)
                      <input 
                        type="range" min="1" max="100" step="1" 
                        value={pumpFlowRateGpm} 
                        onChange={e => setPumpFlowRateGpm(Number(e.target.value))} 
                      />
                    </label>
                  )}
                  {selectedNode === 'GROW_BED' && (
                    <div className="text-[10px] text-gray-500">
                      Depends on reservoir pH ({targetPh.toFixed(1)}) and incoming flow ({pumpFlowRateGpm} GPM).
                    </div>
                  )}
                  
                  {/* Live JSON snippet for the node */}
                  <div className="mt-2 bg-[#050302] border border-[#1A1410] p-2 rounded text-[9px] text-gray-400 font-mono whitespace-pre overflow-x-auto">
                    {selectedNode === 'PUMP' && JSON.stringify(manifest.nodes['pump_01'], null, 2)}
                    {selectedNode === 'GROW_BED' && JSON.stringify(manifest.nodes['grow_bed_01'], null, 2)}
                    {selectedNode === 'SENSOR' && sensorEnabled && JSON.stringify(manifest.nodes['sensor_01'], null, 2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

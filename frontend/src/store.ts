import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';

export type Soulfile = {
  agent_id: string;
  name: string;
  type: string;
  mempalace_wing_ref?: string;
  persona_prompt?: string;
  wallet?: {
    network?: string;
    balances?: Record<string, number>;
  };
  physical_state?: {
    current_action?: string;
    location?: [number, number];
    chassis_goal?: string;
  };
  // Allow forward-compatible fields without breaking the UI.
  [k: string]: unknown;
};

interface LMStudioState {
  status: string;
  isOnline: boolean;
  lastResponseAt: number | null;
  messages: Array<{ role: string, content: string }>;
  temperature: number;
  maxTokens: number;
  systemPromptOverride: string;
  soulfile: Soulfile | null;
  emberBalance: number;
  emberPulseAt: number | null;
  setStatus: (status: string, isOnline: boolean) => void;
  markLmResponse: () => void;
  addMessage: (role: string, content: string) => void;
  clearMessages: () => void;
  setParameters: (temp: number, tokens: number, prompt: string) => void;
  loadSoulfile: () => Promise<void>;
  saveSoulfile: (next: Soulfile) => Promise<void>;
}

interface GraphState {
  nodes: Node[];
  edges: Edge[];
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
}

export const useLMStudioStore = create<LMStudioState>((set) => ({
  status: 'Checking Port 1234...',
  isOnline: false,
  lastResponseAt: null,
  messages: [],
  temperature: 0.7,
  maxTokens: -1,
  systemPromptOverride: '',
  soulfile: null,
  emberBalance: 0,
  emberPulseAt: null,
  setStatus: (status, isOnline) => set({ status, isOnline }),
  markLmResponse: () => set({ lastResponseAt: Date.now(), isOnline: true }),
  addMessage: (role, content) => set((state) => ({ messages: [...state.messages, { role, content }] })),
  clearMessages: () => set({ messages: [] }),
  setParameters: (temperature, maxTokens, systemPromptOverride) =>
    set({ temperature, maxTokens, systemPromptOverride }),
  loadSoulfile: async () => {
    const res = await fetch('/__hearth/soulfile');
    if (!res.ok) throw new Error(`Soulfile GET failed: ${res.status}`);
    const next = (await res.json()) as Soulfile;
    const ember = next.wallet?.balances?.EMBER ?? 0;
    set((state) => ({
      soulfile: next,
      emberBalance: ember,
      emberPulseAt: ember > state.emberBalance ? Date.now() : state.emberPulseAt,
    }));
  },
  saveSoulfile: async (next) => {
    const res = await fetch('/__hearth/soulfile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    if (!res.ok && res.status !== 204) throw new Error(`Soulfile PUT failed: ${res.status}`);
    const ember = next.wallet?.balances?.EMBER ?? 0;
    set((state) => ({
      soulfile: next,
      emberBalance: ember,
      emberPulseAt: ember > state.emberBalance ? Date.now() : state.emberPulseAt,
    }));
  },
}));

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
}));

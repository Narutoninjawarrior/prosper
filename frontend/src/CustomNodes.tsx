import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { User, Cpu, Box, ShieldAlert } from 'lucide-react';

export function AgentNode({ data }: NodeProps) {
  const agentId = data.agent as string;
  
  let colors = { text: '#10b981', border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', shadow: 'rgba(16, 185, 129, 0.4)' };
  let Icon = Cpu;
  let title = "Agent Wing";

  if (agentId === 'solis') {
    colors = { text: '#d97706', border: '#d97706', bg: 'rgba(217, 119, 6, 0.1)', shadow: 'rgba(217, 119, 6, 0.4)' }; 
    Icon = ShieldAlert;
    title = "Solis Wing";
  } else if (agentId === 'prosper2') {
    colors = { text: '#3b82f6', border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', shadow: 'rgba(59, 130, 246, 0.4)' }; 
    Icon = User;
    title = "Prosper2 Wing";
  }

  return (
    <div 
      className="px-4 py-3 rounded-lg flex items-center gap-3 backdrop-blur-md transition-all font-mono"
      style={{ 
        border: `1px solid ${colors.border}`, 
        backgroundColor: colors.bg, 
        color: '#e2e8f0',
        boxShadow: `0 0 15px ${colors.shadow}` 
      }}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 opacity-0" />
      <Icon size={20} style={{ color: colors.text }} />
      <div className="flex flex-col pr-2">
        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: colors.text }}>{title}</span>
        <span className="text-sm text-gray-300">{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-500 rounded-none mix-blend-screen" />
    </div>
  );
}

export function DefaultNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-2 rounded-lg border border-gray-700 bg-gray-900/80 text-gray-200 text-xs tracking-wide font-sans backdrop-blur-sm shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
      <Handle type="target" position={Position.Top} className="w-1.5 h-1.5 !bg-gray-400 rounded-sm"/>
      <div className="flex items-center justify-center gap-2 text-center whitespace-pre-wrap leading-relaxed">
        <Box size={14} className="text-gray-400 min-w-[14px]"/>
        <span>{data.label as string}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-1.5 h-1.5 !bg-gray-400 rounded-sm" />
    </div>
  );
}

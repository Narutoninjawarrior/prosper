import { ArrowRight, Plus, Minus, Edit2, Info } from 'lucide-react';

export type DiffType = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffResult {
  path: string;
  type: DiffType;
  oldValue?: any;
  newValue?: any;
}

function isObject(val: any) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

export function computeDiff(obj1: any, obj2: any, currentPath = ''): DiffResult[] {
  let diffs: DiffResult[] = [];

  const keys1 = Object.keys(obj1 || {});
  const keys2 = Object.keys(obj2 || {});
  const allKeys = Array.from(new Set([...keys1, ...keys2]));

  allKeys.forEach((key) => {
    const path = currentPath ? `${currentPath}.${key}` : key;
    const val1 = obj1?.[key];
    const val2 = obj2?.[key];

    if (!(key in (obj1 || {}))) {
      diffs.push({ path, type: 'added', newValue: val2 });
    } else if (!(key in (obj2 || {}))) {
      diffs.push({ path, type: 'removed', oldValue: val1 });
    } else if (isObject(val1) && isObject(val2)) {
      diffs = diffs.concat(computeDiff(val1, val2, path));
    } else if (Array.isArray(val1) && Array.isArray(val2)) {
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        diffs.push({ path, type: 'changed', oldValue: val1, newValue: val2 });
      }
    } else if (val1 !== val2) {
      diffs.push({ path, type: 'changed', oldValue: val1, newValue: val2 });
    }
  });

  return diffs;
}

interface ArtifactDiffPanelProps {
  original: any;
  modified: any;
  title?: string;
  onClose?: () => void;
}

export default function ArtifactDiffPanel({ original, modified, title = 'Artifact Diff', onClose }: ArtifactDiffPanelProps) {
  const diffs = computeDiff(original, modified).filter(d => d.type !== 'unchanged');

  const addedCount = diffs.filter(d => d.type === 'added').length;
  const removedCount = diffs.filter(d => d.type === 'removed').length;
  const changedCount = diffs.filter(d => d.type === 'changed').length;

  const renderValue = (val: any) => {
    if (val === undefined) return 'undefined';
    if (val === null) return 'null';
    if (typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  return (
    <div className="bg-[#0A0604] border border-[#2A1F16] rounded-lg overflow-hidden flex flex-col max-h-[600px]">
      <div className="bg-[#1A1410] px-4 py-3 border-b border-[#2A1F16] flex items-center justify-between">
        <h3 className="text-[#c9bba5] font-mono text-sm uppercase tracking-widest font-bold flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-[#D4A853]" />
          {title}
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none">
            &times;
          </button>
        )}
      </div>

      <div className="px-4 py-3 bg-black/40 border-b border-[#2A1F16] flex items-center gap-6">
        <div className="flex items-center gap-2 text-xs font-mono">
          <Plus className="w-3 h-3 text-[#34D399]" />
          <span className="text-[#34D399]">{addedCount} Added</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <Minus className="w-3 h-3 text-red-400" />
          <span className="text-red-400">{removedCount} Removed</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <Edit2 className="w-3 h-3 text-[#D4A853]" />
          <span className="text-[#D4A853]">{changedCount} Changed</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-2">
        {diffs.length === 0 ? (
          <div className="text-gray-500 text-xs uppercase tracking-widest text-center py-8">
            No structural differences found.
          </div>
        ) : (
          diffs.map((diff, i) => (
            <div key={i} className="font-mono text-xs border border-[#2A1F16] rounded bg-black/20 overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1A1410]/50 border-b border-[#2A1F16] text-[#b7c9be]">
                {diff.path}
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {diff.type !== 'added' && (
                  <div className={`p-2 rounded bg-red-900/10 border border-red-900/30 ${diff.type === 'removed' ? 'col-span-1 md:col-span-2' : ''}`}>
                    <div className="text-[9px] uppercase tracking-widest text-red-400/70 mb-1">Original</div>
                    <pre className="whitespace-pre-wrap text-red-200">{renderValue(diff.oldValue)}</pre>
                  </div>
                )}
                {diff.type !== 'removed' && (
                  <div className={`p-2 rounded bg-[#34D399]/5 border border-[#34D399]/20 ${diff.type === 'added' ? 'col-span-1 md:col-span-2' : ''}`}>
                    <div className="text-[9px] uppercase tracking-widest text-[#34D399]/70 mb-1">Modified</div>
                    <pre className="whitespace-pre-wrap text-[#34D399]">{renderValue(diff.newValue)}</pre>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-[#1A1410]/50 px-4 py-2 border-t border-[#2A1F16] flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-widest">
        <Info className="w-3 h-3" />
        Local review only. Diffing does not publish, witness, or commit state.
      </div>
    </div>
  );
}

/**
 * InventoryStagingLocker
 * Local-first physical resource staging layer.
 * NOT procurement automation. NOT a warehouse management system.
 * NOT real supply-chain sync. Seeded data only in V1.
 */
import { useState, useMemo } from 'react';
import { Package, AlertTriangle, CheckCircle2, MinusCircle, Clock, Info, Lock, Unlock } from 'lucide-react';

export type ResourceCategory = 'material' | 'tool' | 'slot' | 'utility';
export type ResourceStatus = 'available' | 'reserved' | 'exhausted' | 'planned';

export interface InventoryResource {
  id: string;
  title: string;
  category: ResourceCategory;
  quantity_total: number;
  quantity_reserved: number;
  unit: string;
  location_note: string;
  status: ResourceStatus;
  notes: string;
}

export interface ReservationIntent {
  resource_id: string;
  quantity_requested: number;
  plan_id: string;
  plan_title: string;
}

export interface ConflictResult {
  resource_id: string;
  resource_title: string;
  kind: 'over_allocated' | 'insufficient_stock' | 'exhausted';
  requested: number;
  available: number;
  unit: string;
}

// --- Seeded inventory (V1: local only, no backend sync) ---
const SEED_INVENTORY: InventoryResource[] = [
  {
    id: 'res-hempcrete-01',
    title: 'Hempcrete Mix',
    category: 'material',
    quantity_total: 500,
    quantity_reserved: 50,
    unit: 'kg',
    location_note: 'Yard B, Pallet Stack 3',
    status: 'available',
    notes: 'Batch expires Q4 2026',
  },
  {
    id: 'res-timber-01',
    title: 'Timber Framing (2×6)',
    category: 'material',
    quantity_total: 80,
    quantity_reserved: 30,
    unit: 'boards',
    location_note: 'Lumber Shed, Row 2',
    status: 'available',
    notes: 'Kiln-dried. Check moisture before use.',
  },
  {
    id: 'res-pvc-pipe-01',
    title: 'PVC Pipe (1.5")',
    category: 'material',
    quantity_total: 120,
    quantity_reserved: 120,
    unit: 'meters',
    location_note: 'Workshop rear wall',
    status: 'exhausted',
    notes: 'All currently staged to Aquaculture Node plan.',
  },
  {
    id: 'res-drill-01',
    title: 'Cordless Drill (20V)',
    category: 'tool',
    quantity_total: 3,
    quantity_reserved: 1,
    unit: 'units',
    location_note: 'Tool Wall, Bay A',
    status: 'available',
    notes: 'Batteries shared. Reserve battery slot separately.',
  },
  {
    id: 'res-concrete-mixer-01',
    title: 'Concrete Mixer (130L)',
    category: 'tool',
    quantity_total: 1,
    quantity_reserved: 1,
    unit: 'units',
    location_note: 'Equipment Bay 2',
    status: 'reserved',
    notes: 'Reserved for Workshop Pod build through June 30.',
  },
  {
    id: 'res-grid-slot-01',
    title: 'Grid Power Drop (20A)',
    category: 'slot',
    quantity_total: 4,
    quantity_reserved: 2,
    unit: 'slots',
    location_note: 'Panel Box C',
    status: 'available',
    notes: 'Permits required for slots 3–4.',
  },
  {
    id: 'res-water-main-01',
    title: 'Water Main Tap (1")',
    category: 'utility',
    quantity_total: 2,
    quantity_reserved: 0,
    unit: 'taps',
    location_note: 'North line, near greenhouse',
    status: 'available',
    notes: 'Flow rate: ~40L/min per tap.',
  },
];

function statusColor(status: ResourceStatus) {
  switch (status) {
    case 'available': return 'text-[#34D399]';
    case 'reserved': return 'text-[#D4A853]';
    case 'exhausted': return 'text-red-400';
    case 'planned': return 'text-[#60A5FA]';
  }
}

function statusIcon(status: ResourceStatus) {
  switch (status) {
    case 'available': return <CheckCircle2 className="w-3 h-3" />;
    case 'reserved': return <Lock className="w-3 h-3" />;
    case 'exhausted': return <MinusCircle className="w-3 h-3" />;
    case 'planned': return <Clock className="w-3 h-3" />;
  }
}

function computeStatus(r: InventoryResource): ResourceStatus {
  if (r.quantity_reserved >= r.quantity_total) return 'exhausted';
  if (r.quantity_reserved > 0) return 'reserved';
  return r.status === 'planned' ? 'planned' : 'available';
}

function availableQty(r: InventoryResource): number {
  return Math.max(0, r.quantity_total - r.quantity_reserved);
}

interface InventoryStagingLockerProps {
  /** BOM material strings from the active facility plan */
  planMaterials?: string[];
  /** Facility plan id for reservation tagging */
  planId?: string;
  planTitle?: string;
}

export default function InventoryStagingLocker({
  planMaterials = [],
  planId = 'unlinked',
  planTitle = 'Unnamed Plan',
}: InventoryStagingLockerProps) {
  const [inventory, setInventory] = useState<InventoryResource[]>(SEED_INVENTORY);
  const [filterCategory, setFilterCategory] = useState<ResourceCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reserveInputs, setReserveInputs] = useState<Record<string, number>>({});

  const CATEGORIES: Array<ResourceCategory | 'all'> = ['all', 'material', 'tool', 'slot', 'utility'];

  // Fuzzy match BOM strings against inventory titles
  const bomMatches = useMemo(() => {
    const matched = new Set<string>();
    planMaterials.forEach((mat) => {
      const lower = mat.toLowerCase();
      inventory.forEach((res) => {
        if (res.title.toLowerCase().split(' ').some((word) => lower.includes(word))) {
          matched.add(res.id);
        }
      });
    });
    return matched;
  }, [planMaterials, inventory]);

  const conflicts = useMemo<ConflictResult[]>(() => {
    const out: ConflictResult[] = [];
    inventory.forEach((res) => {
      const avail = availableQty(res);
      const s = computeStatus(res);
      if (s === 'exhausted') {
        out.push({ resource_id: res.id, resource_title: res.title, kind: 'exhausted', requested: 0, available: 0, unit: res.unit });
      } else if (avail === 0 && res.quantity_total > 0) {
        out.push({ resource_id: res.id, resource_title: res.title, kind: 'insufficient_stock', requested: 0, available: 0, unit: res.unit });
      }
    });
    return out;
  }, [inventory]);

  const handleReserve = (res: InventoryResource) => {
    const qty = reserveInputs[res.id] ?? 1;
    const avail = availableQty(res);
    if (qty <= 0 || qty > avail) return;
    setInventory((prev) =>
      prev.map((r) =>
        r.id === res.id
          ? { ...r, quantity_reserved: r.quantity_reserved + qty }
          : r
      )
    );
    setReserveInputs((prev) => ({ ...prev, [res.id]: 1 }));
  };

  const handleRelease = (id: string) => {
    setInventory((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, quantity_reserved: 0 }
          : r
      )
    );
  };

  const filtered = inventory.filter((r) => filterCategory === 'all' || r.category === filterCategory);

  return (
    <div className="flex flex-col gap-4 font-mono text-sm">

      {/* Header */}
      <div className="border-b border-[#7A9E7E]/20 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <Package className="w-4 h-4 text-[#7A9E7E]" />
          <h3 className="text-[#b7c9be] text-xs uppercase tracking-widest font-bold">Inventory Staging Locker</h3>
        </div>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest bg-black/40 border border-[#2A1F16] inline-block px-3 py-1.5 rounded">
          Physical staging only. Not procurement automation. Not a warehouse system. Local session data.
        </p>
      </div>

      {/* Conflict Banner */}
      {conflicts.length > 0 && (
        <div className="border border-red-900/40 bg-red-950/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-400 text-[10px] uppercase tracking-widest font-bold mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {conflicts.length} Resource Conflict{conflicts.length > 1 ? 's' : ''} Detected
          </div>
          <ul className="space-y-1">
            {conflicts.map((c) => (
              <li key={c.resource_id} className="text-[11px] text-red-300 flex items-start gap-2">
                <MinusCircle className="w-3 h-3 mt-0.5 shrink-0 text-red-500" />
                <span>
                  <span className="font-bold">{c.resource_title}</span>
                  {' — '}
                  {c.kind === 'exhausted' && 'Fully exhausted. All stock is staged elsewhere.'}
                  {c.kind === 'insufficient_stock' && 'No available stock. Fully reserved.'}
                  {c.kind === 'over_allocated' && `Over-allocated. Requested ${c.requested} ${c.unit}, only ${c.available} available.`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* BOM Cross-reference notice */}
      {planMaterials.length > 0 && (
        <div className="border border-[#60A5FA]/20 bg-[#60A5FA]/5 rounded p-3 text-[10px] text-[#c5d7e8] flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#60A5FA]" />
          <span>
            Plan BOM has <strong>{planMaterials.length}</strong> material line{planMaterials.length !== 1 ? 's' : ''}.{' '}
            <strong>{bomMatches.size}</strong> fuzzy-matched to locker inventory. Highlighted below.
            Unmatched BOM items are not tracked in the locker yet.
          </span>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded border transition-colors ${
              filterCategory === cat
                ? 'border-[#7A9E7E] text-[#7A9E7E] bg-[#7A9E7E]/10'
                : 'border-[#2A1F16] text-gray-500 hover:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Resource table */}
      <div className="flex flex-col gap-2">
        {filtered.map((res) => {
          const avail = availableQty(res);
          const computed = computeStatus(res);
          const pct = res.quantity_total > 0 ? (res.quantity_reserved / res.quantity_total) * 100 : 0;
          const isBomMatch = bomMatches.has(res.id);
          const isExpanded = expandedId === res.id;
          const inputQty = reserveInputs[res.id] ?? 1;

          return (
            <div
              key={res.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                isBomMatch
                  ? 'border-[#60A5FA]/30 bg-[#60A5FA]/5'
                  : computed === 'exhausted'
                  ? 'border-red-900/30 bg-red-950/10'
                  : 'border-[#2A1F16] bg-black/20'
              }`}
            >
              {/* Row summary */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : res.id)}
                className="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {isBomMatch && (
                    <span className="text-[9px] text-[#60A5FA] border border-[#60A5FA]/30 px-1.5 py-0.5 rounded uppercase tracking-widest shrink-0">BOM</span>
                  )}
                  <span className="text-[#c9bba5] text-xs font-bold truncate">{res.title}</span>
                  <span className="text-[9px] text-gray-600 uppercase tracking-widest shrink-0">{res.category}</span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  {/* Usage bar */}
                  <div className="w-24 hidden md:flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1A1410] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct > 50 ? 'bg-[#D4A853]' : 'bg-[#34D399]'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400">
                    {avail} / {res.quantity_total} {res.unit} free
                  </span>
                  <span className={`flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold ${statusColor(computed)}`}>
                    {statusIcon(computed)} {computed}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-[#2A1F16] p-3 bg-black/20 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                    <div>
                      <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Total</div>
                      <div className="text-white">{res.quantity_total} {res.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Reserved</div>
                      <div className={res.quantity_reserved > 0 ? 'text-[#D4A853]' : 'text-white'}>{res.quantity_reserved} {res.unit}</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Available</div>
                      <div className={avail === 0 ? 'text-red-400' : 'text-[#34D399]'}>{avail} {res.unit}</div>
                    </div>
                    <div className="col-span-2 md:col-span-3">
                      <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Location</div>
                      <div className="text-gray-300">{res.location_note || '—'}</div>
                    </div>
                    {res.notes && (
                      <div className="col-span-2 md:col-span-3">
                        <div className="text-[9px] text-gray-600 uppercase tracking-widest mb-0.5">Notes</div>
                        <div className="text-gray-400 italic">{res.notes}</div>
                      </div>
                    )}
                  </div>

                  {/* Reserve action */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#2A1F16]">
                    <input
                      type="number"
                      min={1}
                      max={avail}
                      value={inputQty}
                      onChange={(e) => setReserveInputs((prev) => ({ ...prev, [res.id]: Number(e.target.value) }))}
                      className="w-20 bg-black/40 border border-[#2A1F16] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7A9E7E]"
                    />
                    <span className="text-[10px] text-gray-500">{res.unit}</span>
                    <button
                      onClick={() => handleReserve(res)}
                      disabled={avail === 0 || inputQty <= 0 || inputQty > avail}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded border border-[#7A9E7E]/40 text-[#7A9E7E] hover:bg-[#7A9E7E]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Lock className="w-3 h-3" /> Reserve for Plan
                    </button>
                    {res.quantity_reserved > 0 && (
                      <button
                        onClick={() => handleRelease(res.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-widest rounded border border-red-900/40 text-red-400 hover:bg-red-950/20 transition-colors"
                      >
                        <Unlock className="w-3 h-3" /> Release All
                      </button>
                    )}
                    {inputQty > avail && avail > 0 && (
                      <span className="text-red-400 text-[10px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Over-allocated
                      </span>
                    )}
                  </div>

                  {/* Plan tagging note */}
                  <div className="text-[9px] text-gray-600 italic">
                    Reservations tagged to: <span className="text-gray-400">{planTitle}</span> ({planId})
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Session boundary note */}
      <div className="text-[10px] text-[#8a7a64] italic mt-2 flex items-center gap-1.5">
        <Info className="w-3 h-3 shrink-0" />
        Locker state is local to this browser session. Reservations do not persist, sync across operators, or trigger procurement.
      </div>
    </div>
  );
}

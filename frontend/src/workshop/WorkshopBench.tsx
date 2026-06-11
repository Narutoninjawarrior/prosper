import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Check, Clipboard, Hammer, Loader2, ShieldCheck } from 'lucide-react';

type CatalogPart = {
  part_id: string;
  name: string;
  category: string;
  ember_cost: number;
  buildable: boolean;
};

type Finding = {
  code: string;
  path: string;
  detail: string;
};

type Receipt = {
  receipt: string;
  kind: 'validation' | 'preview';
  valid: boolean;
  catalog_version: string;
  receipt_hash: string;
  errors: Finding[];
  warnings: Finding[];
  compatibility: Finding[];
  cost_estimate: { total_ember: number };
  footprint: {
    min_x: number | null;
    max_x: number | null;
    min_z: number | null;
    max_z: number | null;
  };
  world_write: false;
};

const EXAMPLE_BLUEPRINT = {
  schema: 'workshop-v1',
  title: 'Moss Garden Pool',
  author: 'guest-builder',
  parts: [
    { part_id: 'water_pool', position: { x: 0, z: 0 }, rotation_deg: 0, config: {} },
    { part_id: 'flora_flower', position: { x: 1.5, z: 0 }, rotation_deg: 0, config: {} },
  ],
  tags: ['garden', 'water'],
  notes: 'A deterministic workshop draft. Validation never writes to the world.',
};

function FindingList({ label, findings, tone }: { label: string; findings: Finding[]; tone: 'error' | 'warning' | 'info' }) {
  if (findings.length === 0) return null;
  const colors = {
    error: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    info: 'border-sky-200 bg-sky-50 text-sky-900',
  };
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#6f8379]">
        {label} ({findings.length})
      </div>
      <ul className="space-y-2" role="list">
        {findings.map((item, index) => (
          <li key={`${item.code}-${item.path}-${index}`} className={`rounded-xl border px-3 py-2 text-xs leading-5 ${colors[tone]}`}>
            <span className="font-bold">{tone === 'error' ? 'Error' : tone === 'warning' ? 'Warning' : 'Compatibility'}: {item.code}</span>
            <code className="ml-2 text-[10px] opacity-70">{item.path}</code>
            <div>{item.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function WorkshopBench() {
  const [source, setSource] = useState(() => JSON.stringify(EXAMPLE_BLUEPRINT, null, 2));
  const [catalog, setCatalog] = useState<CatalogPart[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/workshop/catalog')
      .then(async (response) => {
        if (!response.ok) throw new Error(`catalog returned ${response.status}`);
        return response.json() as Promise<{ parts?: CatalogPart[] }>;
      })
      .then((body) => {
        if (active) setCatalog(Array.isArray(body.parts) ? body.parts : []);
      })
      .catch(() => {
        if (active) setCatalogError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const buildableCount = useMemo(() => catalog.filter((part) => part.buildable).length, [catalog]);

  async function validate() {
    setSyntaxError(null);
    setRequestError(null);
    setReceipt(null);

    let blueprint: unknown;
    try {
      blueprint = JSON.parse(source);
    } catch (error) {
      setSyntaxError(error instanceof Error ? error.message : 'Invalid JSON');
      return;
    }

    setValidating(true);
    try {
      const response = await fetch('/api/workshop/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint, mode: 'validation' }),
      });
      const body = await response.json() as Receipt | { error?: string };
      if (!response.ok || !('receipt_hash' in body)) {
        throw new Error('error' in body && body.error ? body.error : `validator returned ${response.status}`);
      }
      setReceipt(body);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Workshop backend unreachable');
    } finally {
      setValidating(false);
    }
  }

  async function copyReceipt() {
    if (!receipt) return;
    await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="rounded-3xl border border-[#d8e5d9] bg-white/95 p-5 shadow-[0_18px_50px_rgba(97,127,105,0.1)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.4em] text-[#657c70]">
            <Bot size={14} className="text-[#1c6c4d]" /> Workshop Bench
          </div>
          <h2 className="mt-1 text-xl font-semibold text-[#123228]">Deterministic blueprint validation for humans and bots</h2>
          <p className="mt-2 text-sm leading-6 text-[#62766d]">
            Draft a <code className="text-[12px]">workshop-v1</code> blueprint, check world bounds and part compatibility,
            and receive reproducible hashes from the same pure validator used by the MCP tool.
          </p>
        </div>
        <span className="w-fit rounded-full border border-[#1c6c4d]/20 bg-[#eef8f1] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1c6c4d]">
          read-only server validation
        </span>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#d5ecda] bg-[#f3faf4] px-4 py-3 text-xs leading-5 text-[#315a47]">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <strong>No world write performed. Receipts are never witnessed.</strong>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e1eee3] bg-[#fbfefa] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="workshop-blueprint" className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#657c70]">
              Blueprint JSON
            </label>
            <button
              type="button"
              onClick={() => setSource(JSON.stringify(EXAMPLE_BLUEPRINT, null, 2))}
              className="rounded-full border border-[#cfe0d2] bg-white px-3 py-1 text-[10px] font-semibold text-[#315a47] hover:bg-[#f1f8f2] focus:outline-none focus:ring-2 focus:ring-[#1c6c4d]/30"
            >
              Load example
            </button>
          </div>
          <textarea
            id="workshop-blueprint"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
            className="min-h-[320px] w-full resize-y rounded-xl border border-[#cfe0d2] bg-white px-4 py-3 font-mono text-[13px] leading-5 text-[#18382d] focus:border-[#1c6c4d] focus:outline-none focus:ring-2 focus:ring-[#1c6c4d]/15"
          />

          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#657c70]">
              Part catalog {catalog.length > 0 ? `- ${buildableCount} buildable / ${catalog.length} recognized` : ''}
            </div>
            {catalogError ? (
              <div className="mt-2 text-xs text-amber-800">Catalog endpoint unavailable. Validation can still be attempted.</div>
            ) : catalog.length === 0 ? (
              <div className="mt-2 text-xs text-[#7b8d84]">Loading catalog...</div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {catalog.map((part) => (
                  <span
                    key={part.part_id}
                    title={`${part.name} - ${part.ember_cost} estimated $EMBER`}
                    className={`rounded-full border px-2.5 py-1 text-[10px] ${
                      part.buildable
                        ? 'border-[#b8d9c0] bg-[#eef8f1] text-[#245b40]'
                        : 'border-[#ded8ca] bg-[#f7f4ec] text-[#8a7a64]'
                    }`}
                  >
                    <code>{part.part_id}</code> · {part.ember_cost} · {part.buildable ? 'buildable' : 'catalog only'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {syntaxError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <div><strong>Syntax error - not validated.</strong> {syntaxError}</div>
            </div>
          )}
          <button
            type="button"
            onClick={validate}
            disabled={validating}
            className="sticky bottom-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1c6c4d] px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-lg hover:bg-[#154f39] focus:outline-none focus:ring-2 focus:ring-[#1c6c4d]/35 disabled:cursor-wait disabled:opacity-70"
          >
            {validating ? <Loader2 size={15} className="animate-spin" /> : <Hammer size={15} />}
            {validating ? 'Validating' : 'Validate blueprint'}
          </button>
        </div>

        <div className="flex min-h-[420px] flex-col gap-4 rounded-2xl border border-[#e1eee3] bg-[#f4f9f5] p-4" aria-live="polite">
          <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#657c70]">Validation receipt</div>
          {requestError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
              <strong>Workshop backend unreachable - nothing was validated.</strong>
              <div>{requestError}</div>
            </div>
          )}
          {!receipt && !requestError && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#cfded2] bg-white/60 p-8 text-center text-sm leading-6 text-[#7b8d84]">
              Submit the example or your own blueprint. Syntax checks happen here; all world rules run on the server.
            </div>
          )}
          {receipt && (
            <>
              <div className={`rounded-xl border px-4 py-3 ${receipt.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {receipt.valid ? <Check size={16} /> : <AlertTriangle size={16} />}
                  {receipt.valid ? 'Blueprint valid' : `Blueprint invalid - ${receipt.errors.length} error${receipt.errors.length === 1 ? '' : 's'}`}
                </div>
                <div className="mt-1 text-xs">Catalog {receipt.catalog_version} · {receipt.kind}</div>
              </div>

              <FindingList label="Errors" findings={receipt.errors} tone="error" />
              <FindingList label="Warnings" findings={receipt.warnings} tone="warning" />
              <FindingList label="Compatibility" findings={receipt.compatibility} tone="info" />

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[#dce8de] bg-white p-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#73867c]">Estimated cost</div>
                  <div className="mt-1 text-lg font-semibold text-[#18382d]">{receipt.cost_estimate.total_ember} $EMBER</div>
                  <div className="text-[10px] text-[#7b8d84]">No charge or hold performed</div>
                </div>
                <div className="rounded-xl border border-[#dce8de] bg-white p-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#73867c]">Footprint</div>
                  <div className="mt-1 text-xs leading-5 text-[#18382d]">
                    x {String(receipt.footprint.min_x)}..{String(receipt.footprint.max_x)}<br />
                    z {String(receipt.footprint.min_z)}..{String(receipt.footprint.max_z)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#dce8de] bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#73867c]">Reproducible receipt hash</div>
                  <button
                    type="button"
                    onClick={copyReceipt}
                    className="inline-flex items-center gap-1 rounded-full border border-[#cfe0d2] px-2.5 py-1 text-[10px] text-[#315a47] focus:outline-none focus:ring-2 focus:ring-[#1c6c4d]/30"
                  >
                    {copied ? <Check size={12} /> : <Clipboard size={12} />}
                    {copied ? 'Copied' : 'Copy receipt'}
                  </button>
                </div>
                <code className="mt-2 block break-all text-[10px] leading-4 text-[#315a47]">{receipt.receipt_hash}</code>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

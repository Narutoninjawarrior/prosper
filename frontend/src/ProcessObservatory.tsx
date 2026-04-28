import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw, AlertTriangle, Server } from 'lucide-react'

type ProcRow = { pid: number; name: string; commandLine: string }

export default function ProcessObservatory() {
  const [rows, setRows] = useState<ProcRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/__hearth/processes', { cache: 'no-store' })
      const text = await res.text()
      if (!res.ok) {
        let detail = text
        try {
          const j = JSON.parse(text)
          detail = j.detail || j.error || text
        } catch {
          /* ignore */
        }
        throw new Error(detail || `HTTP ${res.status}`)
      }
      const data = JSON.parse(text) as ProcRow[] | ProcRow
      const list = Array.isArray(data) ? data : [data]
      setRows(list)
      setUpdatedAt(new Date().toLocaleString())
    } catch (e) {
      setRows([])
      setError(
        e instanceof Error
          ? e.message
          : 'Could not load processes. Run `npm run dev` from D:\\Hearth\\prosper2\\frontend — this panel only works with the local Vite dev server.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 8000)
    return () => window.clearInterval(id)
  }, [load])

  return (
    <div className="flex flex-col h-full w-full p-6 text-gray-200 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-widest font-mono text-[#10b981] flex items-center gap-2">
            <Activity size={22} /> Process Observatory
          </h2>
          <p className="text-xs text-gray-500 mt-2 max-w-xl leading-relaxed">
            Local dev only: shows Hearth-related Windows processes (node, python, Cursor, paths containing{' '}
            <span className="text-[#10b981]">D:\Hearth</span>, LM Studio, OpenClaw). This is not a full Task Manager
            replacement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt && (
            <span className="text-[10px] font-mono text-gray-500">Updated {updatedAt}</span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981] text-xs font-bold font-mono hover:bg-[#10b981]/25 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex gap-3 text-amber-200 text-sm">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <p className="font-bold font-mono text-xs uppercase tracking-wide mb-1">Observatory offline</p>
            <p className="text-xs text-amber-100/90">{error}</p>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 rounded-2xl border border-[#10b981]/20 bg-black/40 overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-gray-800/80 flex items-center gap-2 text-[10px] font-mono text-gray-500 uppercase tracking-widest">
          <Server size={12} />
          Filtered process list ({rows.length})
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="sticky top-0 bg-[#0a120e] z-10 border-b border-gray-800">
              <tr className="text-gray-500">
                <th className="p-3 w-20">PID</th>
                <th className="p-3 w-36">Name</th>
                <th className="p-3">Command line</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !error && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    {loading ? 'Scanning…' : 'No matching processes (or still loading).'}
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={`${r.pid}-${r.name}`} className="border-b border-gray-800/50 hover:bg-white/[0.03]">
                  <td className="p-3 align-top text-[#10b981] tabular-nums">{r.pid}</td>
                  <td className="p-3 align-top text-gray-300">{r.name}</td>
                  <td className="p-3 align-top text-gray-500 break-all whitespace-pre-wrap">
                    {highlightHearth(r.commandLine || '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 p-4 rounded-xl border border-gray-800 bg-black/30 text-[10px] text-gray-500 font-mono leading-relaxed space-y-2">
        <p>
          <span className="text-[#10b981]">Auto-start (optional):</span> run{' '}
          <code className="text-gray-400">D:\Hearth\Install_AutoStart_Ignition.bat</code> once to add full-stack ignition to
          Windows Startup. For dashboard-only, use <code className="text-gray-400">Install_AutoStart_Dashboard.bat</code>.
        </p>
        <p>
          <span className="text-gray-400">Website deploy:</span> this observatory API exists only on the dev server. A
          hosted website would need a backend or drop this feature — use <code className="text-gray-400">npm run build</code>{' '}
          for static UI, without <code className="text-gray-400">/__hearth/*</code> bridges.
        </p>
      </div>
    </div>
  )
}

function highlightHearth(s: string) {
  if (!s) return ''
  const parts = s.split(/(D:[\\/]Hearth[^\s]*)/gi)
  return parts.map((part, i) =>
    /^D:[\\/]Hearth/i.test(part) ? (
      <span key={i} className="text-[#10b981]/90">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

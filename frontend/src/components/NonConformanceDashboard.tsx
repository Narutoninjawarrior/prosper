import React, { useState, useEffect } from 'react';
import { sqliteClient } from '../lib/sqliteClient';
import { AlertCircle, Clock, RotateCcw, Activity } from 'lucide-react';

export const NonConformanceDashboard = () => {
  const [ncs, setNcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const rows = await sqliteClient.query('SELECT * FROM non_conformances ORDER BY created_at DESC');
      setNcs(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const [form, setForm] = useState({
    title: '', description: '', severity: 'minor', source: 'internal_audit'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `nc_${Date.now()}`;
    await sqliteClient.exec(
      `INSERT INTO non_conformances (id, title, description, severity, source, status) 
       VALUES ('${id}', '${form.title}', '${form.description}', '${form.severity}', '${form.source}', 'identified')`
    );
    setShowForm(false);
    loadData();
  };

  if (loading) return <div className="p-4 text-rose-400 font-mono">LOADING NON-CONFORMANCE LOG...</div>;

  const openNcs = ncs.filter(n => n.status !== 'closed');
  const overdueActions = ncs.filter(n => n.action_deadline && new Date(n.action_deadline).getTime() < Date.now() && n.status !== 'closed').length;
  const recurrent = ncs.filter(n => n.is_recurrent).length;

  const closedNcs = ncs.filter(n => n.status === 'closed' && n.action_completed_at && n.created_at);
  const mttr = closedNcs.length > 0 
    ? closedNcs.reduce((acc, n) => acc + (new Date(n.action_completed_at).getTime() - new Date(n.created_at).getTime()), 0) / closedNcs.length / (1000 * 60 * 60 * 24)
    : 0;

  

  return (
    <div className="flex flex-col gap-6 p-6 font-sans text-slate-300">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <h2 className="text-2xl font-bold text-slate-100 font-mono uppercase tracking-widest">Non-Conformance Log</h2>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="bg-rose-900/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900 px-4 py-2 rounded text-sm font-bold uppercase tracking-widest">
          + Log Deviation
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-black/40 border border-slate-700 p-6 rounded grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-slate-400">Title</label>
            <input required type="text" className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-slate-400">Severity</label>
            <select className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={form.severity} onChange={e => setForm({...form, severity: e.target.value})}>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <label className="text-xs uppercase tracking-widest text-slate-400">Description</label>
            <textarea required className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-widest text-slate-400">Source</label>
            <select className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
              <option value="internal_audit">Internal Audit</option>
              <option value="external_audit">External Audit</option>
              <option value="sensor_alert">Sensor Alert</option>
              <option value="operator_report">Operator Report</option>
            </select>
          </div>
          <div className="flex justify-end items-end md:col-span-2">
            <button type="submit" className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-2 rounded uppercase tracking-widest font-bold text-sm">Submit</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded text-center">
          <div className="flex justify-center items-center gap-2 text-[10px] text-rose-400 uppercase tracking-widest mb-1"><AlertCircle className="w-3 h-3" /> Open Issues</div>
          <div className="text-3xl text-rose-300 font-mono">{openNcs.length}</div>
        </div>
        <div className="bg-orange-950/30 border border-orange-900/50 p-4 rounded text-center">
          <div className="flex justify-center items-center gap-2 text-[10px] text-orange-400 uppercase tracking-widest mb-1"><Clock className="w-3 h-3" /> Overdue Actions</div>
          <div className="text-3xl text-orange-300 font-mono">{overdueActions}</div>
        </div>
        <div className="bg-purple-950/30 border border-purple-900/50 p-4 rounded text-center">
          <div className="flex justify-center items-center gap-2 text-[10px] text-purple-400 uppercase tracking-widest mb-1"><RotateCcw className="w-3 h-3" /> Recurrent</div>
          <div className="text-3xl text-purple-300 font-mono">{recurrent}</div>
        </div>
        <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded text-center">
          <div className="flex justify-center items-center gap-2 text-[10px] text-blue-400 uppercase tracking-widest mb-1"><Activity className="w-3 h-3" /> Mean Time to Close</div>
          <div className="text-3xl text-blue-300 font-mono">{mttr.toFixed(1)} <span className="text-lg">days</span></div>
        </div>
      </div>

      <div className="bg-black/40 border border-slate-800 rounded overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Title</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Status</th>
              <th className="p-3">Source</th>
              <th className="p-3">Created</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {ncs.map(nc => (
              <tr key={nc.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-mono text-[10px] text-slate-500">{nc.id.split('_')[1]}</td>
                <td className="p-3 font-bold text-slate-200">{nc.title}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-[9px] uppercase tracking-widest rounded border font-mono ${
                    nc.severity === 'critical' ? 'bg-red-950/50 text-red-400 border-red-900' :
                    nc.severity === 'major' ? 'bg-orange-950/50 text-orange-400 border-orange-900' :
                    'bg-yellow-950/50 text-yellow-400 border-yellow-900'
                  }`}>
                    {nc.severity}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-[9px] uppercase tracking-widest rounded border font-mono ${
                    nc.status === 'closed' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' :
                    'bg-blue-950/50 text-blue-400 border-blue-900'
                  }`}>
                    {nc.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-slate-400 text-xs">{nc.source.replace(/_/g, ' ')}</td>
                <td className="p-3 text-slate-400 font-mono">{new Date(nc.created_at).toLocaleDateString()}</td>
                <td className="p-3 text-right">
                  <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs">Review</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

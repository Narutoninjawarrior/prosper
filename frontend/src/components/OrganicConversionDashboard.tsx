import { useState, useEffect } from 'react';
import { sqliteClient } from '../lib/sqliteClient';
import { ShieldAlert, Leaf } from 'lucide-react';

export const OrganicConversionDashboard = () => {
  const [beds, setBeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const rows = await sqliteClient.query('SELECT * FROM growing_beds ORDER BY conversion_start_date ASC');
        setBeds(rows);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="p-4 text-emerald-400 font-mono">LOADING CONVERSION DATA...</div>;

  const total = beds.length;
  const certified = beds.filter(b => b.conversion_status === 'certified_organic').length;
  const conventional = beds.filter(b => b.conversion_status === 'conventional').length;
  const inConversion = total - certified - conventional;
  
  const y1 = beds.filter(b => b.conversion_status === 'conversion_year_1').length;
  const y2 = beds.filter(b => b.conversion_status === 'conversion_year_2').length;

  const getDaysRemaining = (projectedStr: string) => {
    if (!projectedStr) return 0;
    const days = Math.ceil((new Date(projectedStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const nextAudit = beds
    .map(b => b.next_audit_date ? new Date(b.next_audit_date).getTime() : Infinity)
    .sort()[0];
  const nextAuditDate = nextAudit === Infinity ? 'None scheduled' : new Date(nextAudit).toLocaleDateString();

  return (
    <div className="flex flex-col gap-6 p-6 font-sans text-slate-300">
      <div className="flex items-center gap-3 mb-2">
        <Leaf className="w-8 h-8 text-emerald-500" />
        <h2 className="text-2xl font-bold text-slate-100 font-mono uppercase tracking-widest">Organic Conversion Tracker</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-900 border border-slate-700 p-4 rounded text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Total Beds</div>
          <div className="text-3xl text-white font-mono">{total}</div>
        </div>
        <div className="bg-emerald-950/30 border border-emerald-900/50 p-4 rounded text-center">
          <div className="text-[10px] text-emerald-400 uppercase tracking-widest mb-1">Certified Organic</div>
          <div className="text-3xl text-emerald-300 font-mono">{certified}</div>
        </div>
        <div className="bg-amber-950/30 border border-amber-900/50 p-4 rounded text-center">
          <div className="text-[10px] text-amber-400 uppercase tracking-widest mb-1">In Conversion</div>
          <div className="text-3xl text-amber-300 font-mono">{inConversion}</div>
          <div className="text-[9px] text-amber-500/70 mt-1">Y1: {y1} | Y2: {y2}</div>
        </div>
        <div className="bg-slate-800 border border-slate-700 p-4 rounded text-center">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Conventional</div>
          <div className="text-3xl text-slate-300 font-mono">{conventional}</div>
        </div>
        <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded text-center">
          <div className="text-[10px] text-blue-400 uppercase tracking-widest mb-1">Next Audit Due</div>
          <div className="text-lg text-blue-300 font-mono mt-2">{nextAuditDate}</div>
        </div>
      </div>

      {beds.map(b => {
        const nextTime = b.next_audit_date ? new Date(b.next_audit_date).getTime() : 0;
        const daysToAudit = nextTime > 0 ? Math.ceil((nextTime - Date.now()) / (1000 * 60 * 60 * 24)) : Infinity;
        if (daysToAudit <= 30 && daysToAudit > 0) {
          return (
            <div key={`alert-${b.id}`} className="bg-red-950/40 border border-red-900/50 text-red-400 p-3 rounded flex items-center gap-2 text-sm font-bold">
              <ShieldAlert className="w-4 h-4" />
              Audit due for {b.name} on {new Date(b.next_audit_date).toLocaleDateString()}. Prepare documentation.
            </div>
          );
        }
        return null;
      })}

      <div className="bg-black/40 border border-slate-800 rounded overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase tracking-widest">
            <tr>
              <th className="p-3">Bed Name</th>
              <th className="p-3">Zone</th>
              <th className="p-3">Area (sqm)</th>
              <th className="p-3">Status</th>
              <th className="p-3">Start Date</th>
              <th className="p-3">Days Remaining</th>
              <th className="p-3">Next Audit</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {beds.map(b => (
              <tr key={b.id} className="hover:bg-slate-900/50 transition-colors">
                <td className="p-3 font-bold text-slate-200">{b.name}</td>
                <td className="p-3 text-slate-400">{b.facility_zone || '-'}</td>
                <td className="p-3 text-slate-400 font-mono">{b.area_sqm}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 text-[10px] uppercase tracking-widest rounded border font-mono ${
                    b.conversion_status === 'certified_organic' ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' :
                    b.conversion_status === 'conversion_year_2' ? 'bg-amber-950/50 text-amber-400 border-amber-900' :
                    b.conversion_status === 'conversion_year_1' ? 'bg-yellow-950/50 text-yellow-400 border-yellow-900' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {b.conversion_status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="p-3 text-slate-400 font-mono">{b.conversion_start_date ? new Date(b.conversion_start_date).toLocaleDateString() : '-'}</td>
                <td className="p-3 text-slate-400 font-mono">
                  {b.conversion_status === 'certified_organic' ? '0' : getDaysRemaining(b.projected_certification_date)}
                </td>
                <td className="p-3 text-slate-400 font-mono">{b.next_audit_date ? new Date(b.next_audit_date).toLocaleDateString() : '-'}</td>
                <td className="p-3 text-right">
                  <button className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs">View History</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

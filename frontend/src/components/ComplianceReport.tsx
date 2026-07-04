import { useState } from 'react';
import { generateComplianceReport, type ComplianceReport } from '../lib/complianceReportGenerator';
import { FileDown, Printer, ShieldCheck } from 'lucide-react';

export const ComplianceReportDashboard = () => {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const rep = await generateComplianceReport(startDate, endDate);
      setReport(rep);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!report) return;
    const htmlContent = document.getElementById('report-content')?.innerHTML;
    if (!htmlContent) return;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Compliance Report</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; color: #333; }
          h1, h2, h3 { color: #111; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
          th, td { border: 1px solid #ccc; padding: 0.5rem; text-align: left; }
          th { background: #eee; }
          .section { margin-bottom: 2rem; }
        </style>
      </head>
      <body>${htmlContent}</body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${startDate}-to-${endDate}.html`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-6 p-6 font-sans text-slate-300">
      <div className="flex items-center gap-3 mb-2 print:hidden">
        <ShieldCheck className="w-8 h-8 text-emerald-500" />
        <h2 className="text-2xl font-bold text-slate-100 font-mono uppercase tracking-widest">Compliance Report Generator</h2>
      </div>

      <div className="flex gap-4 items-end bg-black/40 p-4 border border-slate-700 rounded print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-widest">Start Date</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-400 uppercase tracking-widest">End Date</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 p-2 rounded text-white" />
        </div>
        <button onClick={handleGenerate} disabled={loading} className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded uppercase font-bold tracking-widest">
          {loading ? 'Compiling audit documentation...' : 'Generate Report'}
        </button>
      </div>

      {report && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2 print:hidden">
            <button onClick={handlePrint} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded flex items-center gap-2 text-sm uppercase tracking-widest">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={handleDownload} className="bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 border border-blue-900 px-3 py-1 rounded flex items-center gap-2 text-sm uppercase tracking-widest">
              <FileDown className="w-4 h-4" /> Download as HTML
            </button>
          </div>

          <div id="report-content" className="bg-white text-black p-8 rounded min-h-[800px] border border-slate-300 shadow-xl overflow-y-auto" style={{ fontFamily: 'sans-serif' }}>
            <div className="section text-center border-b-2 border-black pb-4 mb-6">
              <h1 className="text-3xl font-bold uppercase tracking-widest mb-2">Stewardship Compliance Report</h1>
              <p><strong>Operator:</strong> {report.operator}</p>
              <p><strong>Period:</strong> {report.report_period.start} to {report.report_period.end}</p>
              <p><strong>Generated:</strong> {new Date(report.generated_at).toLocaleString()}</p>
              <p><strong>Merkle Root:</strong> <span className="font-mono text-[10px] bg-slate-100 p-1 rounded break-all">{report.sections.merkle_integrity}</span></p>
            </div>

            <div className="section mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 mb-2 pb-1">1. Executive Summary</h2>
              <p className="leading-relaxed">{report.sections.executive_summary}</p>
            </div>

            <div className="section mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 mb-2 pb-1">2. Bed Inventory</h2>
              <table className="w-full text-sm border-collapse border border-gray-300 text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">Bed Name</th>
                    <th className="border border-gray-300 p-2">Zone</th>
                    <th className="border border-gray-300 p-2">Area (sqm)</th>
                    <th className="border border-gray-300 p-2">Conversion Status</th>
                    <th className="border border-gray-300 p-2">Start Date</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.bed_inventory.length === 0 && <tr><td colSpan={5} className="p-2 text-center text-gray-500">No beds recorded</td></tr>}
                  {report.sections.bed_inventory.map((b, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 p-2">{b.name}</td>
                      <td className="border border-gray-300 p-2">{b.facility_zone}</td>
                      <td className="border border-gray-300 p-2">{b.area_sqm}</td>
                      <td className="border border-gray-300 p-2 uppercase">{b.conversion_status.replace(/_/g, ' ')}</td>
                      <td className="border border-gray-300 p-2">{b.conversion_start_date ? new Date(b.conversion_start_date).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 mb-2 pb-1">3. Input Records (Soil Amendments)</h2>
              <table className="w-full text-sm border-collapse border border-gray-300 text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">Date</th>
                    <th className="border border-gray-300 p-2">Type</th>
                    <th className="border border-gray-300 p-2">Quantity</th>
                    <th className="border border-gray-300 p-2">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.input_records.length === 0 && <tr><td colSpan={4} className="p-2 text-center text-gray-500">No amendments in this period</td></tr>}
                  {report.sections.input_records.map((a, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 p-2">{new Date(a.application_date).toLocaleDateString()}</td>
                      <td className="border border-gray-300 p-2">{a.amendment_type}</td>
                      <td className="border border-gray-300 p-2">{a.quantity_kg ? `${a.quantity_kg} kg` : `${a.quantity_liters} L`}</td>
                      <td className="border border-gray-300 p-2">{a.application_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 mb-2 pb-1">4. Output Records (Harvests)</h2>
              <table className="w-full text-sm border-collapse border border-gray-300 text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">Date</th>
                    <th className="border border-gray-300 p-2">Asset ID</th>
                    <th className="border border-gray-300 p-2">Weight (kg)</th>
                    <th className="border border-gray-300 p-2">Quality</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.output_records.length === 0 && <tr><td colSpan={4} className="p-2 text-center text-gray-500">No harvests in this period</td></tr>}
                  {report.sections.output_records.map((h, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 p-2">{new Date(h.harvest_date).toLocaleDateString()}</td>
                      <td className="border border-gray-300 p-2">{h.asset_id}</td>
                      <td className="border border-gray-300 p-2">{h.weight_kg}</td>
                      <td className="border border-gray-300 p-2">{h.quality_grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="section mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 mb-2 pb-1">5. Non-Conformances & Corrective Actions</h2>
              <table className="w-full text-sm border-collapse border border-gray-300 text-left">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 p-2">ID</th>
                    <th className="border border-gray-300 p-2">Title</th>
                    <th className="border border-gray-300 p-2">Severity</th>
                    <th className="border border-gray-300 p-2">Status</th>
                    <th className="border border-gray-300 p-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {report.sections.non_conformances.length === 0 && <tr><td colSpan={5} className="p-2 text-center text-gray-500">No non-conformances logged</td></tr>}
                  {report.sections.non_conformances.map((nc, i) => (
                    <tr key={i}>
                      <td className="border border-gray-300 p-2 font-mono text-xs">{nc.id.substring(0, 12)}...</td>
                      <td className="border border-gray-300 p-2">{nc.title}</td>
                      <td className="border border-gray-300 p-2 uppercase">{nc.severity}</td>
                      <td className="border border-gray-300 p-2 uppercase">{nc.status.replace(/_/g, ' ')}</td>
                      <td className="border border-gray-300 p-2">{new Date(nc.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="section mb-6">
              <h2 className="text-xl font-bold uppercase border-b border-gray-300 mb-2 pb-1">6. Integrity Verification</h2>
              <p className="text-sm leading-relaxed">
                This document is generated directly from the immutable SQLite ledger. 
                The Merkle root presented on the cover page can be verified independently by computing the SHA-256 hashes of all underlying JSON event payloads and assembling the corresponding Merkle tree. 
                Any modification to the underlying operational data will result in a mismatched root hash.
              </p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

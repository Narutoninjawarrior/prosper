import { useState, useEffect } from 'react';
import { sqliteClient } from '../lib/sqliteClient';
import { FileText, Edit3, CheckCircle2, AlertTriangle } from 'lucide-react';

export const ICSDocumentManager = () => {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const rows = await sqliteClient.query('SELECT * FROM ics_documents WHERE is_current = 1 ORDER BY title ASC');
      setDocs(rows);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (doc: any) => {
    setEditingId(doc.id);
    setEditForm({ ...doc });
  };

  const handleSave = async (isNewVersion: boolean) => {
    if (!editForm) return;

    if (isNewVersion) {
      // Mark old as not current
      await sqliteClient.exec(`UPDATE ics_documents SET is_current = 0 WHERE id = '${editForm.id}'`);
      // Insert new
      const newVersionNum = (parseFloat(editForm.version) + 0.1).toFixed(1);
      const newId = `ics_${Date.now()}`;
      await sqliteClient.exec(
        `INSERT INTO ics_documents (id, title, category, version, content, approved_by, approved_at, review_due_date, is_current)
         VALUES ('${newId}', '${editForm.title}', '${editForm.category}', '${newVersionNum}', '${editForm.content}', NULL, NULL, '${editForm.review_due_date || ''}', 1)`
      );
    } else {
      // Update existing
      await sqliteClient.exec(
        `UPDATE ics_documents SET 
          title = '${editForm.title}', 
          category = '${editForm.category}', 
          content = '${editForm.content}'
         WHERE id = '${editForm.id}'`
      );
    }
    
    setEditingId(null);
    loadData();
  };

  const handleApprove = async () => {
    if (!editForm) return;
    await sqliteClient.exec(
      `UPDATE ics_documents SET approved_by = 'Operator', approved_at = datetime('now') WHERE id = '${editForm.id}'`
    );
    setEditingId(null);
    loadData();
  };

  if (loading) return <div className="p-4 text-blue-400 font-mono">LOADING ICS DOCUMENTS...</div>;

  return (
    <div className="flex flex-col gap-6 p-6 font-sans text-slate-300">
      <div className="flex items-center gap-3 mb-2">
        <FileText className="w-8 h-8 text-blue-500" />
        <h2 className="text-2xl font-bold text-slate-100 font-mono uppercase tracking-widest">ICS Document Manager</h2>
      </div>

      {docs.map(doc => {
        const reviewDue = doc.review_due_date ? new Date(doc.review_due_date).getTime() : Infinity;
        const daysToReview = reviewDue > 0 ? Math.ceil((reviewDue - Date.now()) / (1000 * 60 * 60 * 24)) : Infinity;
        if (daysToReview <= 30 && daysToReview > 0) {
          return (
            <div key={`alert-${doc.id}`} className="bg-yellow-950/40 border border-yellow-900/50 text-yellow-400 p-3 rounded flex items-center gap-2 text-sm font-bold">
              <AlertTriangle className="w-4 h-4" />
              ICS document "{doc.title}" is due for review on {new Date(doc.review_due_date).toLocaleDateString()}.
            </div>
          );
        }
        return null;
      })}

      <div className="grid grid-cols-1 gap-4">
        {docs.map(doc => (
          <div key={doc.id} className="bg-black/40 border border-slate-700 p-5 rounded-lg flex flex-col gap-4 transition-all">
            {editingId === doc.id ? (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input type="text" className="flex-1 bg-slate-900 border border-slate-700 rounded p-2 text-white font-bold" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} />
                  <select className="bg-slate-900 border border-slate-700 rounded p-2 text-white" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                    <option value="policy">Policy</option>
                    <option value="procedure">Procedure</option>
                    <option value="plan">Plan</option>
                    <option value="record">Record</option>
                  </select>
                </div>
                <textarea className="bg-slate-900 border border-slate-700 rounded p-3 text-slate-300 min-h-[150px] font-mono text-sm leading-relaxed" value={editForm.content} onChange={e => setEditForm({...editForm, content: e.target.value})} />
                
                <div className="flex justify-between items-center mt-2">
                  <div className="flex gap-2">
                    {!doc.approved_by && (
                      <button onClick={handleApprove} className="bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900 px-3 py-1 rounded text-xs uppercase tracking-widest flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-white px-3 py-1 rounded text-xs uppercase tracking-widest">Cancel</button>
                    <button onClick={() => handleSave(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded text-xs uppercase tracking-widest">Save Draft</button>
                    <button onClick={() => handleSave(true)} className="bg-blue-900/50 hover:bg-blue-900/70 text-blue-300 border border-blue-800 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest">Save as v{(parseFloat(doc.version) + 0.1).toFixed(1)}</button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{doc.title}</h3>
                      <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono border border-slate-700">v{doc.version}</span>
                      <span className="bg-blue-950/50 text-blue-400 px-2 py-0.5 rounded text-[10px] uppercase tracking-widest border border-blue-900/50">{doc.category}</span>
                    </div>
                    {doc.approved_by ? (
                      <div className="text-[10px] text-emerald-500 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Approved by {doc.approved_by} on {new Date(doc.approved_at).toLocaleDateString()}
                      </div>
                    ) : (
                      <div className="text-[10px] text-amber-500 font-mono flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Draft / Unapproved
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleEdit(doc)} className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-serif">
                  {doc.content}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { getFirestoreDb } from './firebaseConfig';
import { getFirebaseAuth } from './firebaseAuth';

export function ApprovalLog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    return auth.onAuthStateChanged(async (user) => {
      if (user) {
        const token = await user.getIdTokenResult();
        setIsAdmin(!!token.claims.admin || !!token.claims.sovereign);
      } else {
        setIsAdmin(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const db = getFirestoreDb();
    if (!db) return;

    const q = query(
      collection(db, 'admin_approval_log'),
      orderBy('requested_at', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [isAdmin]);

  if (!isAdmin) return null;
  if (loading) return <div className="text-sm text-[#8E7E6B] px-6 py-6">Loading approval log...</div>;

  return (
    <section id="approval-log" className="rounded-[24px] border border-[#ef4444]/16 bg-[#ef4444]/4 px-6 py-6">
      <h3 className="text-[11px] uppercase tracking-[0.32em] text-[#ef4444] mb-4 flex items-center gap-2">
        <span className="flex-1">Steward Approval Log</span>
      </h3>
      <div className="space-y-3">
        {entries.map(e => (
          <div key={e.id} className="approval-entry flex flex-wrap justify-between items-center border-b border-white/5 pb-2 text-sm gap-4">
            <span className="action text-[#D4A853] font-mono text-[11px]">{e.action}</span>
            <span className="agent text-[#eadfcd] font-mono text-[11px] truncate max-w-[150px]">{e.requested_by}</span>
            <span className="time text-[#8E7E6B] text-[10px]">{e.requested_at?.toDate?.()?.toISOString() || 'Pending'}</span>
            <span className="status approved text-[#34D399] text-[10px] uppercase font-semibold">✓ {e.status}</span>
          </div>
        ))}
        {entries.length === 0 && <div className="text-xs text-[#8E7E6B]">No approvals recorded yet.</div>}
      </div>
    </section>
  );
}

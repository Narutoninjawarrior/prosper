import { readFileSync, writeFileSync } from 'fs';

const path = 'frontend/src/ThreeForge.tsx';
let content = readFileSync(path, 'utf8');

// Find the useEffect that starts the interaction engine
const startMarker = 'useEffect(() => {\r\n    startInteractionEngine(5000); // Start the interaction engine loops';
const endMarker = "    return () => { unsubNodes(); unsubTiles(); };\r\n  }, []);";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('Cannot find markers. startIdx:', startIdx, 'endIdx:', endIdx);
  console.log('Content around useEffect:');
  const idx = content.indexOf('startInteractionEngine');
  console.log(JSON.stringify(content.substring(idx - 30, idx + 100)));
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after = content.substring(endIdx + endMarker.length);

const newBlock = `useEffect(() => {
    startInteractionEngine(5000);

    let unsubNodes = null;
    let unsubTiles = null;
    let cancelled = false;

    const init = async () => {
      const firebaseModule = await import('./firebaseConfig');
      const configured = await firebaseModule.ensureFirebaseConfigured();
      if (cancelled) return;
      if (!configured) { setError('Firebase not configured'); setLoading(false); return; }

      const db = firebaseModule.getFirestoreDb();
      if (!db || cancelled) { setError('Firebase not configured'); setLoading(false); return; }

      const stateRef = doc(db, 'three_forge', 'world_state');

      unsubNodes = onSnapshot(
        stateRef,
        async snap => {
          if (cancelled) return;
          if (snap.exists()) {
            const data = snap.data();
            setNodes((data.nodes || []).filter(n => n && typeof n.x === 'number'));
          } else {
            setNodes([]);
          }
          setLoading(false);
        },
        err => {
          if (cancelled) return;
          console.error('ThreeForge nodes snapshot error:', err);
          setError('Failed to load world state');
          setLoading(false);
        }
      );

      unsubTiles = onSnapshot(
        collection(db, 'world_map'),
        snap => {
          if (cancelled) return;
          const t = [];
          snap.forEach(d => t.push(d.data()));
          setTiles(t);
        },
        err => { console.error('world_map listener error', err); }
      );
    };

    void init();
    return () => { cancelled = true; if (unsubNodes) unsubNodes(); if (unsubTiles) unsubTiles(); };
  }, []);`;

const result = before + newBlock + after;
writeFileSync(path, result, 'utf8');
console.log('SUCCESS - replaced useEffect block');
console.log('Start idx:', startIdx, 'End idx:', endIdx);

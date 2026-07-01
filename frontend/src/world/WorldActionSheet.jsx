import { useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import InspectRail from '../inspect/InspectRail'

// Global state for World Action Sheet so any 3D object can trigger it
let setInspectedObjectGlobal = null;

export function useWorldActionSheet() {
  const [inspectedObject, setInspectedObject] = useState(null)
  const [recentObjects, setRecentObjects] = useState([])

  useEffect(() => {
    setInspectedObjectGlobal = (obj) => {
      setInspectedObject(obj)
      if (obj) {
        setRecentObjects(prev => {
          const filtered = prev.filter(p => p.id !== obj.id)
          return [obj, ...filtered].slice(0, 5)
        })
      }
    }
    return () => {
      setInspectedObjectGlobal = null
    }
  }, [])

  return { inspectedObject, recentObjects, setInspectedObject }
}

export function sendToWorkbench(obj) {
  const payload = {
    source: 'world',
    objectId: obj.id,
    title: obj.title,
    objectType: obj.purpose,
    timestamp: Date.now(),
    freshness: obj.freshness
  }
  sessionStorage.setItem('workbench_handoff', JSON.stringify(payload))
  window.location.href = '/workbench'
}

export function sendToCommons(obj) {
  const existing = JSON.parse(sessionStorage.getItem('hearth_commons_session_prompts') || '[]');
  const newPrompt = {
    id: `local-${Date.now()}`,
    prompt_text: `Review and process world object: ${obj.title} (${obj.id})`,
    author_type: 'human',
    author_id: 'local_user',
    target_type: 'open',
    status: 'draft',
    boundary: 'local_only',
    visibility: 'local_artifact',
    scope: 'world_room',
    source_route: '/world',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_local_session: true,
    object_ref: {
      id: obj.id,
      title: obj.title,
      purpose: obj.purpose,
      source: obj.source,
      freshness: obj.freshness
    }
  };
  sessionStorage.setItem('hearth_commons_session_prompts', JSON.stringify([newPrompt, ...existing]));
  window.location.href = `/commons?source=world&object=${obj.id}`;
}

export function openWorldActionSheet(obj) {
  if (setInspectedObjectGlobal) {
    setInspectedObjectGlobal(obj)
  }
}

export default function WorldActionSheet({ inspectedObject, recentObjects, onClose }) {
  const [showContract, setShowContract] = useState(false)

  // Reset showContract when object changes
  useEffect(() => {
    setShowContract(false)
  }, [inspectedObject?.id])

  if (!inspectedObject && recentObjects.length === 0) return null;

  return createPortal(
    <>
      <InspectRail
        visible={!!inspectedObject}
        eyebrow="World Action Sheet"
        title={inspectedObject?.title || 'Unknown Object'}
        summary={inspectedObject?.purpose || 'No description available'}
        details={[
          { label: 'Source', value: inspectedObject?.source || 'Local' },
          { label: 'Freshness', value: inspectedObject?.freshness || 'Live' },
          ...(inspectedObject?.details || [])
        ]}
        code={showContract && inspectedObject?.renderContract ? JSON.stringify(inspectedObject.renderContract, null, 2) : null}
        actions={
          [
            ...(inspectedObject?.actions || []),
            {
              label: 'Copy Scene Snapshot',
              tone: 'secondary',
              onClick: async () => {
                const { generateSceneManifest } = await import('../lib/sceneManifest');
                const manifest = generateSceneManifest(
                  '/world',
                  inspectedObject || null,
                  recentObjects.length,
                  'local_artifacts_only',
                  inspectedObject?.actions?.map(a => a.label) || [],
                  'Read-only bot inspection generated from user focus'
                );
                try {
                  await navigator.clipboard.writeText(JSON.stringify(manifest, null, 2));
                  alert('Scene Snapshot Copied to Clipboard');
                } catch (err) {
                  console.error('Failed to copy snapshot', err);
                }
              }
            },
            ...(inspectedObject?.renderContract ? [{
              label: showContract ? 'Hide Render Contract' : 'View Render Contract',
              tone: 'secondary',
              onClick: () => setShowContract(!showContract)
            }] : [])
          ]
        }
        potentialActions={inspectedObject?.potentialActions || []}
        onClose={onClose}
        side="right"
        draggable
      />

      {/* Recent inspection continuity strip */}
      <div style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}>
        {recentObjects.map((obj, i) => {
          const isActive = inspectedObject?.id === obj.id;
          return (
            <div key={`${obj.id}-${i}`} style={{
              background: isActive ? 'rgba(24,18,12,0.95)' : 'rgba(10,6,4,0.85)',
              border: isActive ? '1px solid #E8842A' : '0.5px solid #5C3D1E',
              borderRadius: 6,
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: 10,
              color: '#FAF6EF',
              pointerEvents: 'auto',
              cursor: 'pointer',
              opacity: isActive ? 1 : 0.7,
              transition: 'all 0.2s',
              minWidth: 200,
            }} onClick={() => openWorldActionSheet(obj)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ color: isActive ? '#E8842A' : '#D4A853', fontWeight: isActive ? 'bold' : 'normal' }}>
                  {isActive && <span style={{ marginRight: 6 }}>●</span>}
                  {obj.title}
                </div>
              </div>
              <div style={{ fontSize: 9, color: '#888', marginBottom: 2 }}>{obj.purpose}</div>
              <div style={{ display: 'flex', gap: 6, fontSize: 8, color: '#6B7280', textTransform: 'uppercase' }}>
                <span>[{obj.source}]</span>
                <span>·</span>
                <span>{obj.freshness}</span>
              </div>
              {obj.actions && obj.actions.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 9, color: '#4A90D9' }}>
                  {'> '}{obj.actions[0].label.replace(/ \[.*\]/, '')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>,
    document.body
  )
}

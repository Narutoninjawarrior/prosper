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
          return [obj, ...filtered].slice(0, 3)
        })
      }
    }
    return () => {
      setInspectedObjectGlobal = null
    }
  }, [])

  return { inspectedObject, recentObjects, setInspectedObject }
}

export function openWorldActionSheet(obj) {
  if (setInspectedObjectGlobal) {
    setInspectedObjectGlobal(obj)
  }
}

export default function WorldActionSheet({ inspectedObject, recentObjects, onClose }) {
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
        actions={inspectedObject?.actions || []}
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
        {recentObjects.map((obj, i) => (
          <div key={`${obj.id}-${i}`} style={{
            background: 'rgba(10,6,4,0.85)',
            border: '0.5px solid #5C3D1E',
            borderRadius: 6,
            padding: '6px 10px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#FAF6EF',
            pointerEvents: 'auto',
            cursor: 'pointer',
            opacity: inspectedObject?.id === obj.id ? 1 : 0.6,
            transition: 'opacity 0.2s'
          }} onClick={() => openWorldActionSheet(obj)}>
            <div style={{ color: '#E8842A', marginBottom: 2 }}>{obj.title}</div>
            <div style={{ fontSize: 9, color: '#888' }}>{obj.purpose}</div>
          </div>
        ))}
      </div>
    </>,
    document.body
  )
}

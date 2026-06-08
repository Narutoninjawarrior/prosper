/**
 * StewardBubble — in-browser Personal Steward chat overlay.
 */
import { useState, useRef, useEffect } from 'react'
import { useSteward } from './useSteward'

const styles = {
  fab: {
    position: 'fixed',
    zIndex: 35,
    background: 'rgba(10,6,4,0.92)',
    border: '1px solid #D4A853',
    borderRadius: 999,
    padding: '10px 16px',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#FAF6EF',
    cursor: 'pointer',
    boxShadow: '0 0 24px rgba(232,132,42,0.25)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  panel: {
    position: 'fixed',
    zIndex: 35,
    width: 300,
    maxHeight: 400,
    background: 'rgba(10,6,4,0.94)',
    border: '1px solid #C27C5A',
    borderRadius: 12,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#FAF6EF',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
    overflow: 'hidden',
  },
  header: {
    padding: '10px 12px',
    borderBottom: '1px solid #3D2B1A',
    color: '#D4A853',
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minHeight: 120,
    maxHeight: 260,
  },
  inputRow: {
    borderTop: '1px solid #3D2B1A',
    padding: 8,
    display: 'flex',
    gap: 6,
  },
  input: {
    flex: 1,
    background: '#1a120c',
    border: '1px solid #3D2B1A',
    borderRadius: 6,
    padding: '8px',
    color: '#FAF6EF',
    fontSize: 11,
    fontFamily: 'monospace',
  },
}

export default function StewardBubble({
  agentHandle = 'Traveler',
  plotId = null,
  emberBalance = 0,
  realm = 'biosphere',
  anchor = 'right',
  openSignal = 0,
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef(null)

  const {
    initialize,
    chat,
    messages,
    loading,
    progress,
    supported,
    ready,
    error,
    streaming,
  } = useSteward({ agentHandle, plotId, emberBalance, realm })

  const pos = anchor === 'left'
    ? { bottom: 16, left: 16 }
    : { bottom: 16, right: 16 }

  useEffect(() => {
    if (open && supported === null && !loading) {
      initialize()
    }
  }, [open, supported, loading, initialize])

  useEffect(() => {
    if (openSignal > 0) {
      setOpen(true)
    }
  }, [openSignal])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  const handleSend = () => {
    if (!draft.trim() || streaming) return
    chat(draft)
    setDraft('')
  }

  if (!open) {
    return (
      <button
        type="button"
        style={{ ...styles.fab, ...pos }}
        onClick={() => setOpen(true)}
        aria-label="Open Personal Steward"
      >
        <span style={{ color: '#E8842A', fontSize: 14 }}>⬡</span>
        Your Steward
      </button>
    )
  }

  return (
    <div style={{ ...styles.panel, ...pos }}>
      <div style={styles.header}>
        <span>⬡ Personal Steward</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          ✕
        </button>
      </div>

      <div ref={scrollRef} style={styles.body}>
        {supported === false && (
          <div style={{ color: '#E8842A', lineHeight: 1.5, fontSize: 10 }}>
            <strong>WebGPU unavailable in this browser.</strong> Personal Steward needs Chrome
            or Edge 113+ with WebGPU enabled (see <code style={{ color: '#D4A853' }}>chrome://gpu</code>).
            Embedded IDE browsers and Firefox/Safari often block it — open the public site in desktop Chrome to test.
          </div>
        )}

        {error && supported !== false && (
          <div style={{ color: '#e05a4f', lineHeight: 1.5, fontSize: 10, marginBottom: 8 }}>
            <strong>Steward failed to wake.</strong> {error}
            <div style={{ color: '#888', marginTop: 6 }}>
              Confirm <code>/stewardServiceWorker.js</code> loads (DevTools → Application →
              Service Workers), allow the first model download, then hard-refresh.
            </div>
          </div>
        )}

        {loading && (
          <div>
            <div style={{ color: '#7A9E7E', marginBottom: 8 }}>
              Your Steward is waking up… {progress}%
            </div>
            <div style={{
              height: 4,
              background: '#1a120c',
              borderRadius: 2,
              overflow: 'hidden',
            }}
            >
              <div style={{
                width: `${progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #7A9E7E, #E8842A)',
                transition: 'width 0.2s',
              }}
              />
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              padding: '6px 10px',
              borderRadius: 8,
              background: m.role === 'user' ? 'rgba(74,144,217,0.15)' : 'rgba(122,158,126,0.12)',
              border: `1px solid ${m.role === 'user' ? '#4A90D944' : '#7A9E7E44'}`,
              color: '#FAF6EF',
              lineHeight: 1.45,
            }}
          >
            {m.content || (streaming && i === messages.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>

      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder={
            ready
              ? 'Speak to your Steward…'
              : supported === false
                ? 'WebGPU required'
                : error
                  ? 'Steward unavailable — see above'
                  : 'Waiting for model…'
          }
          disabled={!ready || streaming || supported === false}
          maxLength={280}
        />
      </div>

      <div style={{ padding: '0 8px 8px', color: '#555', fontSize: 9 }}>
        Local WebGPU · separate from Solis World Brain
      </div>
    </div>
  )
}

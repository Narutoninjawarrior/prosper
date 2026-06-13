/**
 * PresenceHud — slow MMO chat composer (1 msg / minute).
 */
import { PRESENCE_WS_URL, PRESENCE_IS_LOCAL_DEFAULT } from './multiplayerConfig'

export default function PresenceHud({
  status,
  canChat,
  chatCooldownLeft,
  lastChatError,
  onSend,
  onNameChange,
  displayName,
  remotePeers = [],
}) {
  const handleSubmit = (e) => {
    e.preventDefault()
    const input = e.target.elements.message
    if (onSend(input.value)) input.value = ''
  }

  const statusColor =
    status === 'connected' ? '#7A9E7E' : status === 'error' ? '#f87171' : '#888'

  const offlineHint = PRESENCE_IS_LOCAL_DEFAULT
    ? import.meta.env.PROD
      ? 'Multiplayer chat not configured on this deployment (no VITE_PRESENCE_WS_URL at build). Avatars stay local-only.'
      : `Dev server expected at ${PRESENCE_WS_URL} — run: python presence_server.py`
    : `Cannot reach ${PRESENCE_WS_URL}`

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 30,
        width: 280,
        background: 'rgba(10, 28, 18, 0.9)',
        border: '1px solid #3D6B4F',
        borderRadius: 10,
        padding: '10px 12px',
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#E8F5E9',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div style={{ color: statusColor, marginBottom: 6 }}>
        Presence · {status}
        {status === 'connecting' && PRESENCE_IS_LOCAL_DEFAULT && ' · local dev'}
        {status === 'connected' && !canChat && ` · speak in ${chatCooldownLeft}s`}
      </div>
      {(status === 'offline' || status === 'error') && (
        <div style={{ color: '#888', marginBottom: 6, fontSize: 9, lineHeight: 1.4 }}>
          {offlineHint}
          {PRESENCE_IS_LOCAL_DEFAULT && (
            <span style={{ display: 'block', marginTop: 4, color: '#5a7a62' }}>
              Production: set VITE_PRESENCE_WS_URL in .env.local
            </span>
          )}
        </div>
      )}
      {status === 'connected' && (
        <div style={{ color: '#5a7a62', marginBottom: 6, fontSize: 9 }}>
          In the Lodge: {displayName || 'you'}
          {remotePeers.length > 0
            ? ` · ${remotePeers.map((p) => p.name || p.id).join(', ')}`
            : PRESENCE_IS_LOCAL_DEFAULT
              ? ' · alone on local server'
              : ' · alone'}
          {PRESENCE_IS_LOCAL_DEFAULT && import.meta.env.PROD && (
            <span style={{ display: 'block', marginTop: 4, color: '#888' }}>
              Connected to {PRESENCE_WS_URL} on your machine — other visitors cannot see you until VITE_PRESENCE_WS_URL is set at build.
            </span>
          )}
        </div>
      )}
      <input
        type="text"
        defaultValue={displayName}
        placeholder="Display name"
        onBlur={(e) => onNameChange?.(e.target.value)}
        style={{
          width: '100%',
          marginBottom: 6,
          background: '#0a1a12',
          border: '1px solid #2a4a38',
          borderRadius: 6,
          padding: '6px 8px',
          color: '#FAF6EF',
          fontSize: 10,
        }}
      />
      <form onSubmit={handleSubmit}>
        <input
          name="message"
          maxLength={280}
          disabled={status !== 'connected' || !canChat}
          placeholder={
            status !== 'connected'
              ? status === 'connecting'
                ? `Connecting to ${PRESENCE_WS_URL}…`
                : offlineHint
              : canChat
                ? 'Speak to the garden…'
                : `Slow speech · ${chatCooldownLeft}s`
          }
          style={{
            width: '100%',
            background: '#0a1a12',
            border: '1px solid #2a4a38',
            borderRadius: 6,
            padding: '8px',
            color: '#FAF6EF',
            fontSize: 11,
          }}
        />
      </form>
      {lastChatError && (
        <div style={{ color: '#E8842A', marginTop: 6, fontSize: 9 }}>{lastChatError}</div>
      )}
      <div style={{ color: '#5a7a62', marginTop: 6, fontSize: 9 }}>
        Solarpunk pace · 1 message per minute
      </div>
    </div>
  )
}

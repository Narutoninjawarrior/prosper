import { useState, useRef, useCallback } from 'react'

function toneStyles(tone, accent) {
  if (tone === 'primary') {
    return {
      border: `1px solid ${accent}55`,
      background: `${accent}22`,
      color: '#FAF6EF',
    }
  }
  if (tone === 'warm') {
    return {
      border: '1px solid rgba(212,168,83,0.32)',
      background: 'rgba(212,168,83,0.14)',
      color: '#FAF6EF',
    }
  }
  return {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: '#FAF6EF',
  }
}

export default function InspectRail({
  visible = false,
  accent = '#D4A853',
  eyebrow = 'Inspect',
  title = 'Selection',
  summary = '',
  details = [],
  code = null,
  footer = '',
  actions = [],
  side = 'right',
  top = 112,
  draggable = false,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [dragPos, setDragPos] = useState(null)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })

  const onDragStart = useCallback((e) => {
    if (!draggable) return
    const panel = e.currentTarget.closest('[data-inspect-rail]')
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: dragPos?.x ?? rect.left,
      originY: dragPos?.y ?? rect.top,
    }
    e.preventDefault()
  }, [draggable, dragPos])

  const onDragMove = useCallback((e) => {
    if (!dragRef.current.active) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setDragPos({
      x: Math.max(8, dragRef.current.originX + dx),
      y: Math.max(8, dragRef.current.originY + dy),
    })
  }, [])

  const onDragEnd = useCallback(() => {
    dragRef.current.active = false
  }, [])

  if (!visible) return null

  const positionStyle = dragPos
    ? { left: dragPos.x, top: dragPos.y, right: 'auto' }
    : { [side]: 16, top, right: side === 'right' ? 16 : undefined, left: side === 'left' ? 16 : undefined }

  return (
    <div
      data-inspect-rail
      onMouseMove={onDragMove}
      onMouseUp={onDragEnd}
      onMouseLeave={onDragEnd}
      style={{
      position: 'fixed',
      ...positionStyle,
      zIndex: 25,
      width: collapsed ? 180 : 'min(340px, calc(100vw - 32px))',
      background: 'rgba(10,6,4,0.9)',
      border: `0.5px solid ${accent}`,
      borderRadius: 14,
      padding: 14,
      fontFamily: 'monospace',
      color: '#FAF6EF',
      backdropFilter: 'blur(14px)',
      boxShadow: '0 12px 34px rgba(0,0,0,0.28)',
    }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          alignItems: 'start',
          cursor: draggable ? 'grab' : 'default',
          userSelect: 'none',
        }}
        onMouseDown={onDragStart}
      >
        <div>
          <div style={{ color: accent, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            {eyebrow}{draggable ? ' · drag' : ''}
          </div>
          <div style={{ fontSize: 18, marginTop: 6, lineHeight: 1.2 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#FAF6EF',
              padding: '6px 10px',
              cursor: 'pointer',
              fontSize: 10,
            }}
          >
            {collapsed ? 'Open' : 'Collapse'}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#FAF6EF',
                padding: '6px 10px',
                cursor: 'pointer',
                fontSize: 10,
              }}
            >
              Close
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <>
          {summary && (
            <div style={{ color: '#B89C82', fontSize: 11, lineHeight: 1.6, marginTop: 10 }}>
              {summary}
            </div>
          )}

          {!!details.length && (
            <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
              {details.map((item) => (
                <div
                  key={`${item.label}-${item.value}`}
                  style={{
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '8px 10px',
                    fontSize: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <span style={{ color: '#8E7E6B' }}>{item.label}</span>
                  <span style={{ color: '#FAF6EF', textAlign: 'right' }}>{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {code && (
            <pre style={{
              marginTop: 10,
              maxHeight: 140,
              overflow: 'auto',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: 8,
              color: '#B89C82',
              fontSize: 10,
              lineHeight: 1.45,
            }}>
              {code}
            </pre>
          )}

          {!!actions.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  disabled={action.disabled}
                  style={{
                    ...toneStyles(action.tone, accent),
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 10,
                    cursor: action.disabled ? 'not-allowed' : 'pointer',
                    opacity: action.disabled ? 0.5 : 1,
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {footer && (
            <div style={{ color: '#777', fontSize: 10, marginTop: 10 }}>
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  )
}

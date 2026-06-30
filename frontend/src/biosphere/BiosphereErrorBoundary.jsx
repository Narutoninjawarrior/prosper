import { Component } from 'react'

/**
 * Catches R3F / shader / geometry failures so /biosphere shows an error instead of a blank root.
 */
export default class BiosphereErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Biosphere] render error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            background: '#0A0402',
            color: '#FAF6EF',
            fontFamily: 'monospace',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ color: '#E8842A', fontSize: 16, marginBottom: 12 }}>
            Hearthlands 3D — render halted
          </div>
          <div style={{ color: '#C27C5A', fontSize: 12, marginBottom: 16, maxWidth: 560 }}>
            A shader, geometry, or scene component failed. Check the browser console for the full stack.
          </div>
          <pre
            style={{
              background: 'rgba(10,6,4,0.9)',
              border: '0.5px solid #5C3D1E',
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              color: '#f87171',
            }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 14px',
              background: '#3D2B1A',
              border: '0.5px solid #D4A853',
              borderRadius: 6,
              color: '#FAF6EF',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            Reload biosphere
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

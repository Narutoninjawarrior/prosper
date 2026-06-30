import { Component } from 'react'

/**
 * Inside Canvas: must sit OUTSIDE <Suspense> to catch useGLTF async failures.
 * Renders nothing in 3D on failure; parent App boundary still shows HUD shell.
 */
export default class BiosphereCanvasErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('[Biosphere Canvas]', error?.message || error, info.componentStack)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.failed) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

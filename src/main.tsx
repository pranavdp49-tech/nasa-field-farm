import React from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import './theme.css'
import App from './App'

type BoundaryState = { hasError: boolean; errorMessage: string }

class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { hasError: false, errorMessage: '' }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Field Shift crashed while rendering:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6f8f3', color: '#243a2b', fontFamily: 'system-ui, sans-serif' }}>
          <section style={{ maxWidth: 620, width: '100%', background: '#fff', border: '1px solid #dce6d9', borderRadius: 16, padding: 28, boxSizing: 'border-box' }}>
            <div style={{ color: '#a44c35', fontWeight: 800, letterSpacing: 1.2, fontSize: 12 }}>FIELD SHIFT · RUNTIME ERROR</div>
            <h1 style={{ margin: '10px 0', fontSize: 26 }}>The dashboard could not render.</h1>
            <p style={{ color: '#667567', lineHeight: 1.6 }}>The page caught a rendering error instead of showing a blank screen. Copy the detail below and share it to troubleshoot.</p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#f4f6f1', borderRadius: 8, padding: 14, fontSize: 13 }}>{this.state.errorMessage}</pre>
            <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 8, padding: '11px 15px', color: '#fff', background: '#28674b', fontWeight: 700, cursor: 'pointer' }}>Reload Field Shift</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>,
)

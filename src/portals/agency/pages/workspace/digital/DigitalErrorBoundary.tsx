import { Component, type ReactNode, type ErrorInfo } from 'react'
import { Button } from '@/components/ui/Button'

// Deliberately a small standalone copy of BusinessErrorBoundary rather than
// an import from workspace/business — the instruction for this build is to
// leave unrelated working systems untouched, and this component is a few
// lines of presentational boundary, not a "system" worth cross-wiring at
// the risk of touching Business's working code.

interface Props { children: ReactNode; sectionLabel?: string }
interface State { hasError: boolean; error: Error | null }

export class DigitalErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[DigitalErrorBoundary]', error, info.componentStack)
  }

  retry = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            background: 'var(--surface-solid)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--radius)',
            padding: '40px 32px',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--danger-bg)',
            display: 'grid', placeItems: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
            {this.props.sectionLabel ? `${this.props.sectionLabel} failed to load` : 'Something went wrong'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
            This section encountered an error. Navigation and other sections are unaffected.
          </p>
          <Button variant="primary" size="sm" onClick={this.retry}>Try Again</Button>
        </div>
      )
    }
    return this.props.children
  }
}

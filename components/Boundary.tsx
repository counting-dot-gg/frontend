'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  name: string
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

export default class Boundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] render failed:`, error, info.componentStack)
    this.setState({ info })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div
        role="alert"
        style={{
          margin: 8, padding: '10px 12px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)',
          fontSize: 12, color: '#ffb4b4',
        }}
      >
        <strong>{this.props.name} couldn’t render.</strong> The rest of the page still works:
        screenshot this and ping @pull_fish on Discord.
        <details open style={{ marginTop: 6 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--ink-3)', fontSize: 11 }}>Details</summary>
          <pre style={{
            margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontSize: 10, color: '#ff9a9a',
          }}>
            {this.props.name ? `Where:  ${this.props.name}\n` : ''}
            {typeof window !== 'undefined' ? `URL:    ${window.location.href}\n` : ''}
            {typeof window !== 'undefined' ? `Time:   ${new Date().toISOString()}\n\n` : ''}
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
            {info?.componentStack ? `\n${info.componentStack}` : ''}
          </pre>
        </details>
      </div>
    )
  }
}

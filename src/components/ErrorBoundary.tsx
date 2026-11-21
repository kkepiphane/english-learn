import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error('[English Path]', error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto max-w-md p-6 text-center" role="alert">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-500">Your progress is saved on this device and is safe. Reload the app to continue.</p>
        <pre className="mt-4 overflow-auto rounded-lg bg-ink-100 p-3 text-left text-xs dark:bg-ink-800">{this.state.error.message}</pre>
        <button className="btn-primary mt-4" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}

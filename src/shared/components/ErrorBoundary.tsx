import { Component, type ReactNode } from 'react'
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal">
          <h1>No hemos podido abrir Dayflow</h1>
          <p>
            Recarga la aplicación para volver a intentarlo. Tus datos locales se
            conservan.
          </p>
          <button
            className="button primary"
            onClick={() => window.location.reload()}
          >
            Volver a intentar
          </button>
        </main>
      )
    return this.props.children
  }
}

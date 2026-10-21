import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The boundary is the last line of defence; keep the UI recoverable but
    // never lose the stack while doing it.
    console.error('JEPUB render error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="app-error" role="alert">
        <p className="label">JEPUB</p>
        <h1>Something went wrong</h1>
        <p>The reader hit an unexpected error. Your books are still stored on this device.</p>
        <div>
          <button
            type="button"
            className="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Reload JEPUB
          </button>
        </div>
      </main>
    );
  }
}

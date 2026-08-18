import * as React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    window.electron?.storage?.get('app.theme').catch(() => undefined);
    // Forward to main process logger via a best-effort notification.
    try {
      window.electron?.notifications?.send('LTalk crashed', error.message);
    } catch {
      /* ignore */
    }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg p-8 text-center">
          <h1 className="text-lg font-semibold text-content">Something went wrong</h1>
          <p className="max-w-md text-sm text-content-secondary">{this.state.error.message}</p>
          <button
            className="lt-button lt-button-primary"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

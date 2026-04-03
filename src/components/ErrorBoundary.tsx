// @ts-nocheck
import React from 'react';
import { TriangleAlert } from 'lucide-react';

const isDev = import.meta.env.DEV;

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (isDev) {
      console.error('Expense Tracker UI error boundary caught an error', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center px-4">
          <section className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-6 text-center shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error">
              <TriangleAlert className="h-8 w-8" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-2xl font-semibold tracking-tight text-on-surface">Something interrupted the interface</h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              The app hit an unexpected render error. Refresh the page or try again to continue.
            </p>
            {this.state.error && (
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-surface-container-low px-4 py-3 text-left text-xs text-on-surface-variant">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined });
                  this.props.onReset?.();
                }}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-transform hover:translate-y-[-1px]"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center rounded-full bg-surface-container-low px-5 py-3 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container"
              >
                Reload app
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

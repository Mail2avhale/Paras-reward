/**
 * RouteErrorBoundary — catches render errors from a lazy-loaded route
 * ==================================================================
 * Feb 17 2026 — Introduced after users reported blank screens for the
 * "Pay to Partner Store" route in the Android APK. If a lazy chunk
 * fails to load or the child component throws during render, this
 * boundary shows an actionable "Something went wrong" screen with
 * a Retry button (soft reset via React key remount) and a Go Home
 * button, instead of a silent blank canvas.
 */
import React from 'react';

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, epoch: 0 };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Best-effort logging; safe in native WebView too.
    console.error('[RouteErrorBoundary]', this.props.routeName || 'route', error, info);
  }

  handleRetry = () => {
    // Bump epoch → children with epoch-based `key` prop will remount.
    // Also clear the error so children get rendered again.
    this.setState((s) => ({ error: null, epoch: s.epoch + 1 }));
  };

  handleGoHome = () => {
    try {
      window.location.replace('/dashboard');
    } catch (_) {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6" data-testid="route-error-boundary">
          <div className="max-w-sm w-full text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/15 border-2 border-red-500/50 mx-auto grid place-items-center mb-4">
              <span className="text-3xl">!</span>
            </div>
            <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-400 mb-6">
              We couldn&apos;t load this page just now. Please check your connection and try again.
            </p>
            <div className="flex gap-2">
              <button
                onClick={this.handleRetry}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm"
                data-testid="route-error-retry-btn"
              >
                Retry
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
                data-testid="route-error-home-btn"
              >
                Go to Home
              </button>
            </div>
            {process.env.NODE_ENV !== 'production' && this.state.error?.message && (
              <p className="text-[11px] text-red-400/60 mt-4 font-mono break-all">
                {String(this.state.error.message)}
              </p>
            )}
          </div>
        </div>
      );
    }
    // Pass epoch as a key so Retry remounts the child subtree cleanly.
    return (
      <React.Fragment key={this.state.epoch}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export default RouteErrorBoundary;

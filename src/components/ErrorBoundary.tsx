import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Without this, a render-time throw anywhere in the tree unmounts the whole
// app — the user sees a blank white screen with nothing but a console stack
// trace. This turns that into a visible, recoverable fallback.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface px-6">
          <div className="max-w-sm w-full text-center">
            <div className="text-lg font-bold text-ink-950 mb-2">Une erreur est survenue</div>
            <div className="text-sm text-muted mb-5">
              {this.state.error.message || "Something went wrong while rendering this page."}
            </div>
            <button
              onClick={() => {
                this.setState({ error: null });
                window.location.href = "/dashboard";
              }}
              className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold"
            >
              Retour au tableau de bord
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

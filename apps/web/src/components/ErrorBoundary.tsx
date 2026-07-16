import { Component, type ErrorInfo, type ReactNode } from "react";
import { MaterialIcon } from "./ui/MaterialIcon";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Systemic safety net for render-time exceptions (undefined data access,
 * bad prop shapes, etc.) — separate from missing-route blanks, which
 * React Router handles via the path="*" fallback instead.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh flex flex-col items-center justify-center gap-md px-margin-mobile text-center bg-background">
          <div className="w-16 h-16 rounded-full bg-error-container flex items-center justify-center">
            <MaterialIcon name="error" className="text-error-red text-[32px]" />
          </div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-excellence-blue">
            Une erreur est survenue
          </h1>
          <p className="font-body-sm text-body-sm text-text-secondary max-w-sm">
            Quelque chose s'est mal passé lors de l'affichage de cette page. Essayez de rafraîchir.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-sm bg-excellence-blue text-white px-lg py-sm rounded-lg font-label-lg text-label-lg"
          >
            Rafraîchir la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

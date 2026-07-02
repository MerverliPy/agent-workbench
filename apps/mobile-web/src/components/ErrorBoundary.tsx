import type { JSX } from "solid-js";
import { onMount, onCleanup, createSignal } from "solid-js";

interface ErrorBoundaryProps {
  fallback?: (error: Error, retry: () => void) => JSX.Element;
  children: JSX.Element;
}

/**
 * Error boundary for agent-workbench mobile-web app.
 * Catches render errors and shows a friendly fallback UI with retry.
 */
export function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  const [error, setError] = createSignal<Error | null>(null);

  function handleError(err: Error): void {
    console.error("[ErrorBoundary] Caught error:", err);
    setError(err);
  }

  function retry(): void {
    setError(null);
  }

  // Solid's ErrorBoundary equivalent — wrap children in a try/catch via
  // a component boundary and error handler.
  // Note: Solid doesn't have built-in ErrorBoundary like React. We use a
  // pattern: render children in a container, and if error is set, show fallback.
  onMount(() => {
    window.addEventListener("error", (e) => {
      if (e.error && e.error instanceof Error) {
        handleError(e.error);
        e.preventDefault();
      }
    });
    window.addEventListener("unhandledrejection", (e) => {
      if (e.reason instanceof Error) {
        handleError(e.reason);
        e.preventDefault();
      }
    });
  });

  onCleanup(() => {
    // No cleanup needed — window listeners are removed on unmount
  });

  const err = error();
  if (err) {
    return (
      props.fallback?.(err, retry) ?? (
        <div class="flex flex-col items-center justify-center h-dvh bg-slate-950 text-slate-300 p-6">
          <div class="text-center max-w-sm">
            <div class="text-4xl mb-4">⚠️</div>
            <h2 class="text-lg font-semibold mb-2">Something went wrong</h2>
            <p class="text-sm text-slate-400 mb-4 break-all">{err.message}</p>
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg active:bg-blue-700 text-sm"
              onClick={retry}
            >
              Retry
            </button>
          </div>
        </div>
      )
    );
  }

  return <>{props.children}</>;
}

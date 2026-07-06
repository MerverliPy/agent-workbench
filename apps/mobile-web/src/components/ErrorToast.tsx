import type { JSX } from "solid-js";

interface ErrorToastProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorToast(props: ErrorToastProps): JSX.Element {
  return (
    <div
      class="flex items-start gap-2.5 px-3.5 py-3 rounded-xl max-w-[92%] self-center"
      style="background: var(--danger-soft); border: 1px solid color-mix(in oklch, var(--danger) 30%, transparent); font-size: 13px; color: var(--danger); line-height: 1.45;"
      role="alert"
    >
      <span
        class="text-base shrink-0"
        style="margin-top: 1px;"
        aria-hidden="true"
      >
        ⚠
      </span>
      <div>
        <span>{props.message}</span>
        {props.onRetry && (
          <button
            class="block mt-1.5 text-xs font-semibold underline cursor-pointer"
            style="color: var(--danger);"
            onClick={props.onRetry}
          >
            {props.retryLabel ?? "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}

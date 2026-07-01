import type { JSX } from "solid-js";

export function StreamingIndicator(): JSX.Element {
  return (
    <span class="inline-flex items-center gap-1 ml-1">
      <span class="w-1.5 h-1.5 rounded-full bg-blue-400 streaming-dot" style="animation-delay: 0ms" />
      <span class="w-1.5 h-1.5 rounded-full bg-blue-400 streaming-dot" style="animation-delay: 200ms" />
      <span class="w-1.5 h-1.5 rounded-full bg-blue-400 streaming-dot" style="animation-delay: 400ms" />
    </span>
  );
}

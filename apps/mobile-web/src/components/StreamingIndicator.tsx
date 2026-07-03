import type { JSX } from "solid-js";

/**
 * Typing indicator per DESIGN.md spec:
 * 3 bouncing dots, 1.4s staggered, 7px diameter
 */
export function StreamingIndicator(): JSX.Element {
  return (
    <span class="inline-flex items-center gap-1.5 ml-1">
      <span
        class="w-[7px] h-[7px] rounded-full bg-blue-400 animate-streaming-bounce"
        style="animation-delay: 0ms"
      />
      <span
        class="w-[7px] h-[7px] rounded-full bg-blue-400 animate-streaming-bounce"
        style="animation-delay: 467ms"
      />
      <span
        class="w-[7px] h-[7px] rounded-full bg-blue-400 animate-streaming-bounce"
        style="animation-delay: 933ms"
      />
    </span>
  );
}

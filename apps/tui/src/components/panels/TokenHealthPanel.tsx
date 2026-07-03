import type { JSX } from "@opentui/solid";
import {
  compactionSuggestion,
  setTokenHealthOpen,
  tokenHealth,
} from "../../state/app";

export function TokenHealthPanel(): JSX.Element {
  const th = tokenHealth();
  const compaction = compactionSuggestion();

  if (th === null) {
    return (
      <box
        position="absolute"
        top={4}
        left={8}
        width={56}
        height={10}
        border={true}
        title=" Token Health "
        titleAlignment="center"
        zIndex={20}
        flexDirection="column"
        padding={1}
      >
        <text content="No token health data available yet." />
        <text content="Submit a prompt to trigger a token health update." />
        <text content="" />
        <box
          height={1}
          flexDirection="row"
          onMouseDown={() => setTokenHealthOpen(false)}
        >
          <text content="  [close]" />
        </box>
      </box>
    );
  }

  const statusLabel = th.level.toUpperCase();
  const _statusColor =
    th.level === "critical"
      ? "red"
      : th.level === "strained"
        ? "yellow"
        : th.level === "watch"
          ? "yellow"
          : "green";
  const barWidth = 40;
  const filledChars = Math.round((th.utilizationPercent / 100) * barWidth);
  const emptyChars = barWidth - filledChars;
  const barText = `[${"#".repeat(filledChars)}${".".repeat(emptyChars)}]`;

  const lines: string[] = [
    `Status: ${statusLabel}  ${th.isEstimate ? "(estimate)" : ""}`,
    `Budget: ${th.used}/${th.budget} tokens used`,
    `Remaining: ${th.remaining} tokens`,
    barText,
  ];

  if (compaction !== null) {
    lines.push(
      `Compaction: ~${compaction.currentTokens} → ~${compaction.estimatedCompactedTokens ?? "?"} tokens`,
    );
    if (compaction.reason !== undefined) {
      lines.push(`Reason: ${compaction.reason}`);
    }
  }

  const height = Math.max(8, lines.length + 4);

  return (
    <box
      position="absolute"
      top={4}
      left={8}
      width={56}
      height={height}
      border={true}
      title=" Token Health "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      {lines.map((line) => (
        <text content={line} />
      ))}
      <text content="" />
      <box
        height={1}
        flexDirection="row"
        onMouseDown={() => setTokenHealthOpen(false)}
      >
        <text content="  [close]" />
      </box>
    </box>
  );
}

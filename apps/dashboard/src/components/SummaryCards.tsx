import type { JSX } from "solid-js";
import { formatCost } from "../utils/format";

interface SummaryCardsProps {
  sessions: number;
  spans: number;
  cost: number;
  errors: number;
}

export function SummaryCards(props: SummaryCardsProps): JSX.Element {
  return (
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <SummaryCard label="Total Sessions" value={props.sessions} color="blue" />
      <SummaryCard label="Total Spans" value={props.spans} color="emerald" />
      <SummaryCard label="Today's Cost" value={formatCost(props.cost)} color="amber" />
      <SummaryCard label="Errors" value={props.errors} color={props.errors > 0 ? "red" : "emerald"} />
    </div>
  );
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  color: string;
}): JSX.Element {
  const colorClasses: Record<string, string> = {
    blue: "border-l-blue-500 bg-blue-500/5",
    emerald: "border-l-emerald-500 bg-emerald-500/5",
    amber: "border-l-amber-500 bg-amber-500/5",
    red: "border-l-red-500 bg-red-500/5",
  };

  return (
    <div
      class={`border-l-4 rounded-r-lg px-4 py-3 ${colorClasses[props.color] ?? "border-l-slate-500 bg-slate-500/5"}`}
    >
      <div class="text-xs text-slate-400 uppercase tracking-wide">
        {props.label}
      </div>
      <div class="text-2xl font-bold mt-1">{props.value}</div>
    </div>
  );
}

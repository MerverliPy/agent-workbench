import type { JSX } from "solid-js";
import { Match, Switch } from "solid-js";
import type {
  ApprovalCardData,
  CardType,
  DiffCardData,
  PlanCardData,
  SummaryCardData,
  TerminalCardData,
  ToolActivityCardData,
} from "../../state/app";
import { ApprovalCard } from "./ApprovalCard";
import { DiffCard } from "./DiffCard";
import { PlanCard } from "./PlanCard";
import { SummaryCard } from "./SummaryCard";
import { TerminalCard } from "./TerminalCard";
import { ToolActivityCard } from "./ToolActivityCard";

interface CardRegistryProps {
  cardType: CardType;
  cardData: unknown;
}

export function CardRegistry(props: CardRegistryProps): JSX.Element {
  return (
    <Switch fallback={<div class="text-xs" style="color: var(--muted);">Unknown card type: {props.cardType}</div>}>
      <Match when={props.cardType === "plan"}>
        <PlanCard data={props.cardData as PlanCardData} />
      </Match>
      <Match when={props.cardType === "tool"}>
        <ToolActivityCard data={props.cardData as ToolActivityCardData} />
      </Match>
      <Match when={props.cardType === "diff"}>
        <DiffCard data={props.cardData as DiffCardData} />
      </Match>
      <Match when={props.cardType === "terminal"}>
        <TerminalCard data={props.cardData as TerminalCardData} />
      </Match>
      <Match when={props.cardType === "approval"}>
        <ApprovalCard data={props.cardData as ApprovalCardData} />
      </Match>
      <Match when={props.cardType === "summary"}>
        <SummaryCard data={props.cardData as SummaryCardData} />
      </Match>
    </Switch>
  );
}

import { ModelComparer } from "@agent-workbench/eval";
import type { JSX } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
import { setComparisonOpen } from "../../state/app";

/**
 * Model Comparison panel — side-by-side output comparison across models.
 */
export function ComparisonPanel(): JSX.Element {
  const comparer = new ModelComparer();
  const [prompt, setPrompt] = createSignal("");
  const [models, setModels] = createSignal(
    "gpt-4o:openai,claude-sonnet-4:anthropic",
  );
  const [result, setResult] = createSignal("");
  const [status, setStatus] = createSignal<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = createSignal("");

  async function runCompare(): Promise<void> {
    if (!prompt() || !models()) return;
    setStatus("running");
    setResult("");
    setErrorMsg("");
    try {
      const modelList = models()
        .split(",")
        .map((s) => {
          const [model, provider] = s.trim().split(":");
          return { model: model ?? "", provider: provider ?? "openai" };
        });
      const res = await comparer.compare(prompt(), undefined, modelList);
      const lines = res.results.map(
        (r) =>
          `=== ${r.model} (${r.provider}) ===\n${r.output.slice(0, 500)}\n\nLatency: ${r.latencyMs}ms  Cost: $${r.costUsd.toFixed(4)}  Tokens: ${r.tokensUsed.total}`,
      );
      setResult(lines.join("\n\n"));
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  return (
    <box
      position="absolute"
      top={1}
      left={4}
      width={96}
      height={32}
      border
      title=" Model Comparison "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <text content="Prompt:" />
      <text
        content={prompt() || "(click to fill)"}
        onMouseDown={() =>
          setPrompt(
            "Explain the concept of functional programming in one paragraph.",
          )
        }
      />
      <text
        content={`Models (model:provider,comma-separated): ${models()}`}
        onMouseDown={() => setModels("gpt-4o:openai,claude-sonnet-4:anthropic")}
      />
      <box height={1} flexDirection="row">
        <box border onMouseDown={() => void runCompare()} padding={1}>
          <text
            content={status() === "running" ? " COMPARING... " : " Compare "}
          />
        </box>
        <text content="  " />
        <box border onMouseDown={() => setComparisonOpen(false)} padding={1}>
          <text content=" Close " />
        </box>
      </box>
      <box flexGrow={1} border padding={1}>
        <Show when={status() === "error"}>
          <text content={`Error: ${errorMsg().slice(0, 200)}`} />
        </Show>
        <Show when={status() === "done"}>
          <text content={result().slice(0, 3000)} />
        </Show>
        <Show when={status() === "idle"}>
          <text content="Enter a prompt and model list, then click Compare." />
        </Show>
        <Show when={status() === "running"}>
          <text content="Running comparison across models..." />
        </Show>
      </box>
    </box>
  );
}

import { ModelPlayground } from "@agent-workbench/eval";
import type { JSX } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
import { setPlaygroundOpen } from "../../state/app";

export function PlaygroundPanel(): JSX.Element {
  const playground = new ModelPlayground();
  const [models, setModels] = createSignal<
    Array<{ model: string; provider: string }>
  >([]);
  const [selectedIdx, setSelectedIdx] = createSignal(0);
  const [userMessage, setUserMessage] = createSignal("");
  const [output, setOutput] = createSignal("");
  const [status, setStatus] = createSignal<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = createSignal("");

  playground.listAvailableModels().then((m) => {
    if (m && m.length > 0 && models().length === 0) setModels(m);
  });

  async function runPlayground(): Promise<void> {
    const m = models()[selectedIdx()];
    if (!m || !userMessage()) return;
    setStatus("running");
    setOutput("");
    setErrorMsg("");
    try {
      const result = await playground.send(
        { model: m.model, provider: m.provider },
        userMessage(),
      );
      setOutput(result.output);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }

  const current = models()[selectedIdx()];
  return (
    <box
      position="absolute"
      top={1}
      left={4}
      width={90}
      height={28}
      border
      title=" Model Playground "
      titleAlignment="center"
      zIndex={20}
      flexDirection="column"
      padding={1}
    >
      <text
        content={`Model: ${current?.model ?? "—"} (${current?.provider ?? "—"})`}
      />
      <text content={`Models available: ${models().length}`} />
      <Show when={models().length > 0}>
        <box height={1} flexDirection="row">
          <box
            border
            onMouseDown={() => setSelectedIdx((i) => Math.max(0, i - 1))}
            padding={1}
          >
            <text content=" Prev " />
          </box>
          <text content="  " />
          <box
            border
            onMouseDown={() =>
              setSelectedIdx((i) => Math.min(models().length - 1, i + 1))
            }
            padding={1}
          >
            <text content=" Next " />
          </box>
        </box>
      </Show>
      <text
        content={`Message: ${userMessage() || "(click to fill)"}`}
        onMouseDown={() => setUserMessage("Write a short poem about coding.")}
      />
      <box height={1} flexDirection="row">
        <box border onMouseDown={() => void runPlayground()} padding={1}>
          <text content={status() === "running" ? " RUNNING... " : " Run "} />
        </box>
        <text content="  " />
        <box border onMouseDown={() => setPlaygroundOpen(false)} padding={1}>
          <text content=" Close " />
        </box>
      </box>
      <box flexGrow={1} border padding={1}>
        <Show when={status() === "error"}>
          <text content={`Error: ${errorMsg().slice(0, 200)}`} />
        </Show>
        <Show when={status() === "done" && output().length > 0}>
          <text content={output().slice(0, 2000)} />
        </Show>
        <Show when={status() === "idle"}>
          <text content="Select a model, type a message, click Run." />
        </Show>
        <Show when={status() === "running"}>
          <text content="Waiting for response..." />
        </Show>
      </box>
    </box>
  );
}

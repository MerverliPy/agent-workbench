// Integration adapters — barrel export
//
// Each adapter wraps an external tool (promptfoo, lm-eval, custom scripts)
// and exposes a standard interface used by EvalRunner.dispatch().

export { runCustomEvalScript } from "./custom";
export type { LmEvalAdapterOptions } from "./lm-eval";
export { runLmEvalHarnessBenchmark } from "./lm-eval";
export type { PromptfooEvalOptions } from "./promptfoo";
export { runPromptfooEval } from "./promptfoo";

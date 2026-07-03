// Integration adapters — barrel export
//
// Each adapter wraps an external tool (promptfoo, lm-eval, custom scripts)
// and exposes a standard interface used by EvalRunner.dispatch().

export { runPromptfooEval } from "./promptfoo";
export type { PromptfooEvalOptions } from "./promptfoo";
export { runLmEvalHarnessBenchmark } from "./lm-eval";
export type { LmEvalAdapterOptions } from "./lm-eval";
export { runCustomEvalScript } from "./custom";

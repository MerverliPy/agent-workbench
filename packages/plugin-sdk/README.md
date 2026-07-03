# @agent-workbench/plugin-sdk

Plugin development kit for extending agent-workbench with custom tools, providers, and middleware. Enables third-party developers to build and distribute plugins.

## Usage

```typescript
import { definePlugin } from "@agent-workbench/plugin-sdk";

export default definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  tools: [myCustomTool],
  providers: [myCustomProvider],
});
```

## Scope

- Plugin definition API (`definePlugin`)
- Tool registration contract
- Provider registration contract
- Middleware hooks
- Plugin manifest validation
- Part of Phase 26 (plugin system & extensibility)

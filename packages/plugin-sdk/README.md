# @agent-workbench/plugin-sdk

Plugin development kit for extending agent-workbench with custom tools, providers, and middleware. Enables third-party developers to build and distribute plugins.

## Usage

```typescript
import { definePlugin, ToolPlugin, ProviderPlugin } from "@agent-workbench/plugin-sdk";

// Define a custom plugin
export default definePlugin({
  name: "my-plugin",
  version: "1.0.0",
  description: "Custom tools for my workflow",
  tools: [myCustomTool],
  providers: [myCustomProvider],
});

// Define a tool plugin
const myCustomTool: ToolPlugin = {
  name: "my-tool",
  execute: async (args) => {
    return { result: `Hello, ${args.name}!` };
  },
};
```

## API

| Module | Description |
|--------|-------------|
| `definePlugin()` | Top-level plugin definition API |
| `ToolPlugin` | Contract for defining custom tools |
| `ProviderPlugin` | Contract for defining custom AI providers |
| `PanelPlugin` | Contract for custom UI panels |
| `HookPlugin` | Contract for middleware/hooks |
| `PluginManifest` | Plugin metadata schema and validation |
| `PluginRegistry` | Runtime plugin discovery and lifecycle |

## Scope

- Plugin definition API (`definePlugin`)
- Tool registration contract
- Provider registration contract
- Panel and hook extension points
- Plugin manifest validation
- Plugin registry for lifecycle management

Part of **Phase 26** (plugin system & extensibility).

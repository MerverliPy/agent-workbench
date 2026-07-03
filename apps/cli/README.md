# 🖥️ @agent-workbench/cli

Command-line interface for agent-workbench. Provides plugin management and project scaffolding.

## Commands

| Command | Description |
|---------|-------------|
| `agent-workbench plugin list` | List installed plugins |
| `agent-workbench plugin install <source>` | Install a plugin (local:/path) |
| `agent-workbench plugin enable <name>` | Enable a plugin |
| `agent-workbench plugin disable <name>` | Disable a plugin |
| `agent-workbench plugin uninstall <name>` | Uninstall a plugin |
| `agent-workbench init typescript [path]` | Scaffold a TypeScript project |
| `agent-workbench init bun [path]` | Scaffold a Bun project |

## Usage

```bash
# List installed plugins
npx agent-workbench plugin list

# Scaffold a new TypeScript project
npx agent-workbench init typescript ./my-project
```

## Examples

```bash
agent-workbench plugin install local:~/my-plugin
agent-workbench init bun ./new-app
```

## Scope

- Plugin lifecycle management (install, enable, disable, uninstall)
- Project scaffolding via `init` command
- Template-based project generation

## Boundary

Does **not** own: TUI rendering, server startup, core runtime.

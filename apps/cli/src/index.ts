/**
 * agent-workbench CLI — entry point for plugin management and other commands.
 *
 * Usage:
 *   agent-workbench plugin list
 *   agent-workbench plugin install <source>
 *   agent-workbench plugin enable <name>
 *   agent-workbench plugin disable <name>
 *   agent-workbench plugin uninstall <name>
 */
import { PluginRegistry } from "@agent-workbench/plugin-sdk";

function printUsage(): void {
  console.log(`agent-workbench — CLI for managing agent-workbench plugins

Usage:
  agent-workbench plugin list                      List installed plugins
  agent-workbench plugin install <source>          Install a plugin (local:/path, npm:name)
  agent-workbench plugin enable <name>             Enable a plugin
  agent-workbench plugin disable <name>            Disable a plugin
  agent-workbench plugin uninstall <name>          Uninstall a plugin

Examples:
  agent-workbench plugin list
  agent-workbench plugin install local:~/my-plugin
  agent-workbench plugin enable my-plugin
  agent-workbench plugin disable my-plugin
  agent-workbench plugin uninstall my-plugin
`);
}

async function handlePluginCommand(subcommand: string, args: string[]): Promise<number> {
  const registry = new PluginRegistry();

  switch (subcommand) {
    case "list": {
      const plugins = registry.list();
      if (plugins.length === 0) {
        console.log("No plugins installed.");
      } else {
        for (const p of plugins) {
          const status = p.enabled ? "enabled" : "disabled";
          console.log(`  ${p.name}@${p.version} — ${status} (${p.source})`);
        }
      }
      return 0;
    }

    case "install": {
      const source = args[0];
      if (!source) {
        console.error("Error: 'install' requires a source argument (e.g. 'local:/path/to/plugin')");
        return 1;
      }

      if (source.startsWith("npm:") || source.startsWith("git:")) {
        console.error("Error: npm/git plugin installation is not yet supported. Use 'local:' source.");
        return 1;
      }

      if (!source.startsWith("local:")) {
        console.error("Error: source must use 'local:', 'npm:', or 'git:' prefix");
        console.error("Example: agent-workbench plugin install local:~/my-plugin");
        return 1;
      }

      // For now, we delegate to the server. But CLI has no server; it uses the
      // registry directly. We need a simple install that copies into the plugins dir.
      // Since the full install flow is implemented in the server route, we'll
      // use the registry directly for local: sources.
      const { existsSync, mkdirSync, cpSync } = await import("node:fs");
      const { join } = await import("node:path");

      const localPath = source.slice("local:".length);
      if (!existsSync(localPath)) {
        console.error(`Error: Plugin directory not found: ${localPath}`);
        return 1;
      }

      let manifest;
      try {
        manifest = registry.loadManifest(localPath);
      } catch (err) {
        console.error(`Error: Invalid plugin manifest — ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }

      if (registry.get(manifest.name)) {
        console.error(`Error: Plugin already installed: ${manifest.name}`);
        return 1;
      }

      const installDir = join(registry.getPluginsDir(), manifest.name);
      mkdirSync(installDir, { recursive: true });
      cpSync(localPath, installDir, { recursive: true });

      const record = registry.register(manifest, source, installDir);
      console.log(`Installed: ${record.name}@${record.version} (${record.source})`);
      console.log(`Location: ${record.installPath}`);
      return 0;
    }

    case "enable": {
      const name = args[0];
      if (!name) {
        console.error("Error: 'enable' requires a plugin name");
        return 1;
      }
      try {
        const updated = registry.enable(name);
        console.log(`Enabled: ${updated.name}@${updated.version}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
      return 0;
    }

    case "disable": {
      const name = args[0];
      if (!name) {
        console.error("Error: 'disable' requires a plugin name");
        return 1;
      }
      try {
        const updated = registry.disable(name);
        console.log(`Disabled: ${updated.name}@${updated.version}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
      }
      return 0;
    }

    case "uninstall": {
      const name = args[0];
      if (!name) {
        console.error("Error: 'uninstall' requires a plugin name");
        return 1;
      }
      const plugin = registry.get(name);
      if (!plugin) {
        console.error(`Error: Plugin not found: ${name}`);
        return 1;
      }

      // Remove plugin directory
      const { rmSync } = await import("node:fs");
      try {
        rmSync(plugin.installPath, { recursive: true, force: true });
      } catch {
        // Best-effort
      }

      registry.unregister(name);
      console.log(`Uninstalled: ${name}`);
      return 0;
    }

    default:
      console.error(`Error: Unknown plugin command: ${subcommand}`);
      console.error("  Available: list, install, enable, disable, uninstall");
      return 1;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return args.length === 0 ? 1 : 0;
  }

  const command = args[0];
  const subArgs = args.slice(1);

  switch (command) {
    case "plugin":
    case "plugins":
      if (subArgs.length === 0) {
        console.error("Error: 'plugin' requires a subcommand (list, install, enable, disable, uninstall)");
        return 1;
      }
      return handlePluginCommand(subArgs[0]!, subArgs.slice(1));

    default:
      console.error(`Error: Unknown command: ${command}`);
      printUsage();
      return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);

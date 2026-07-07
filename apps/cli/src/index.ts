/**
 * agent-workbench CLI — entry point for plugin management, CI/CD commands,
 * and project scaffolding.
 *
 * Usage:
 *   agent-workbench plugin list|install|enable|disable|uninstall
 *   agent-workbench init <template> [path]
 *   agent-workbench review --pr <number>
 *   agent-workbench changelog [--from <tag>] [--to <tag>]
 *   agent-workbench pr-describe [--base <branch>] [--head <branch>]
 *
 * Templates: typescript, bun
 */

import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type PluginManifest,
  PluginRegistry,
} from "@agent-workbench/plugin-sdk";
import { handleChangelog } from "./commands/changelog";
import { handlePrDescribe } from "./commands/pr-describe";
import { handleReview } from "./commands/review";

function printUsage(): void {
  console.log(`agent-workbench — CLI for managing agent-workbench

Usage:
  agent-workbench plugin <command> [args]     Manage plugins
  agent-workbench init <template> [path]      Scaffold a new project
  agent-workbench review --pr <number>        PR review bot
  agent-workbench changelog [options]         Generate changelog
  agent-workbench pr-describe [options]       Generate PR description

Plugin Commands:
  agent-workbench plugin list                      List installed plugins
  agent-workbench plugin install <source>          Install a plugin (local:/path)
  agent-workbench plugin enable <name>             Enable a plugin
  agent-workbench plugin disable <name>            Disable a plugin
  agent-workbench plugin uninstall <name>          Uninstall a plugin

Init Command:
  agent-workbench init typescript [path]           Empty TypeScript project
  agent-workbench init bun [path]                  Bun project with test setup

Review Command:
  agent-workbench review --pr <number>             Analyze PR diff and post review
  agent-workbench review --diff <file>             Analyze local diff file
    Options: --repo owner/repo                     GitHub repo (auto-detected)

Changelog Command:
  agent-workbench changelog                        From last tag to HEAD
    Options: --from <tag|commit> --to <tag|commit> Custom range
             --last-release                        Use last tag as base
             --output <file>                       Write to file (default: stdout)

PR Describe Command:
  agent-workbench pr-describe                      From main to HEAD
    Options: --base <branch> --head <branch>       Custom branches
             --pr <number>                         Fetch from GitHub PR
             --output <file>                       Write to file

Examples:
  agent-workbench plugin list
  agent-workbench plugin install local:~/my-plugin
  agent-workbench init typescript ./my-project
  agent-workbench review --pr 42
  agent-workbench changelog --last-release --output CHANGELOG.md
  agent-workbench pr-describe --pr 42 --output PR.md
`);
}

async function handlePluginCommand(
  subcommand: string,
  args: string[],
): Promise<number> {
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
        console.error(
          "Error: 'install' requires a source argument (e.g. 'local:/path/to/plugin')",
        );
        return 1;
      }

      if (source.startsWith("npm:") || source.startsWith("git:")) {
        console.error(
          "Error: npm/git plugin installation is not yet supported. Use 'local:' source.",
        );
        return 1;
      }

      if (!source.startsWith("local:")) {
        console.error(
          "Error: source must use 'local:', 'npm:', or 'git:' prefix",
        );
        console.error(
          "Example: agent-workbench plugin install local:~/my-plugin",
        );
        return 1;
      }

      const { existsSync, mkdirSync, cpSync } = await import("node:fs");
      const { join } = await import("node:path");

      const localPath = source.slice("local:".length);
      if (!existsSync(localPath)) {
        console.error(`Error: Plugin directory not found: ${localPath}`);
        return 1;
      }

      let manifest: PluginManifest | undefined;
      try {
        manifest = registry.loadManifest(localPath);
      } catch (err) {
        console.error(
          `Error: Invalid plugin manifest — ${err instanceof Error ? err.message : String(err)}`,
        );
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
      console.log(
        `Installed: ${record.name}@${record.version} (${record.source})`,
      );
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
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
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
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`,
        );
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

// ── Init command ───────────────────────────────────────────────────────────

async function handleInitCommand(
  template: string,
  outputPath: string,
): Promise<number> {
  const __dirname = resolve(fileURLToPath(import.meta.url), "..");
  const templatesDir = resolve(__dirname, "..", "templates");

  const availableTemplates: Record<string, string> = {
    typescript: join(templatesDir, "typescript"),
    bun: join(templatesDir, "bun"),
  };

  const templateDir = availableTemplates[template];
  if (!templateDir) {
    console.error(`Error: Unknown template "${template}".`);
    console.error(
      `  Available templates: ${Object.keys(availableTemplates).join(", ")}`,
    );
    return 1;
  }

  if (!existsSync(templateDir)) {
    console.error(`Error: Template directory not found: ${templateDir}`);
    return 1;
  }

  const targetDir = resolve(outputPath);
  if (existsSync(targetDir)) {
    console.error(`Error: Target path already exists: ${targetDir}`);
    return 1;
  }

  mkdirSync(targetDir, { recursive: true });
  cpSync(templateDir, targetDir, { recursive: true });

  console.log(`✅ Created project at: ${targetDir}`);
  console.log(`   Template: ${template}`);
  console.log(``);
  console.log(`   Next steps:`);
  console.log(`     cd ${outputPath}`);
  console.log(`     bun install`);
  console.log(`     bun run start`);

  return 0;
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
    case "plugins": {
      const subcommand = subArgs[0];
      if (!subcommand) {
        console.error(
          "Error: 'plugin' requires a subcommand (list, install, enable, disable, uninstall)",
        );
        return 1;
      }
      return handlePluginCommand(subcommand, subArgs.slice(1));
    }

    case "init": {
      const tmpl = subArgs[0];
      if (!tmpl) {
        console.error(
          "Error: 'init' requires a template name (typescript, bun)",
        );
        return 1;
      }
      const path = subArgs[1] ?? ".";
      return handleInitCommand(tmpl, path);
    }

    case "review":
      return handleReview(subArgs);

    case "changelog":
      return handleChangelog(subArgs);

    case "pr-describe":
      return handlePrDescribe(subArgs);

    default:
      console.error(`Error: Unknown command: ${command}`);
      printUsage();
      return 1;
  }
}

const exitCode = await main();
process.exit(exitCode);

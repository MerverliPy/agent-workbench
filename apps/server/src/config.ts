const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost", "0.0.0.0"]);

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid WORKBENCH_PORT: ${value}`);
  }

  return parsed;
}

function parseHost(value: string | undefined): string {
  const host = value?.trim() || DEFAULT_HOST;

  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `Non-loopback host \"${host}\" is not allowed in Phase 3. Use 127.0.0.1, ::1, or localhost.`
    );
  }

  return host;
}

export interface ServerConfig {
  readonly host: string;
  readonly port: number;
  readonly version: string;
  readonly name: string;
  readonly description: string;
}

export function getServerConfig(): ServerConfig {
  return {
    host: parseHost(process.env.WORKBENCH_HOST),
    port: parsePort(process.env.WORKBENCH_PORT),
    version: process.env.npm_package_version || "0.0.0",
    name: process.env.npm_package_name || "@agent-workbench/server",
    description:
      process.env.npm_package_description ||
      "Local HTTP/SSE control plane package. Owns routes, middleware, and server lifecycle only.",
  };
}

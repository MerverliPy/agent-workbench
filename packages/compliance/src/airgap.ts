/**
 * Air-gapped mode.
 *
 * When AGENT_WORKBENCH_AIRGAPPED=true, all external network calls are blocked.
 * Only local loopback services (localhost, 127.0.0.1, ::1) are allowed,
 * enabling local-mode Ollama inference while blocking external provider APIs.
 */

// ── Environment check ────────────────────────────────────────────────────

/** Returns true when air-gapped mode is enabled via environment variable. */
export function isAirGapped(): boolean {
  return process.env.AGENT_WORKBENCH_AIRGAPPED === "true";
}

// ── Local hostname allowlist ─────────────────────────────────────────────

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
]);

/** Check if a URL targets a local loopback address. */
export function isLocalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return LOCAL_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

// ── Error type ───────────────────────────────────────────────────────────

export class AirGapBlockedError extends Error {
  constructor(url: string) {
    super(
      `Air-gapped mode: external network calls are disabled. ` +
        `Blocked request to "${url}". ` +
        `Set AGENT_WORKBENCH_AIRGAPPED=false or unset it to allow external providers.`,
    );
    this.name = "AirGapBlockedError";
  }
}

// ── Fetch wrapper ────────────────────────────────────────────────────────

/**
 * Creates a fetch wrapper that blocks all external (non-loopback) URLs.
 *
 * In air-gapped mode:
 * - Local services (localhost, 127.0.0.1, ::1) → allowed
 * - External provider APIs (api.openai.com, api.anthropic.com, etc.) → blocked
 *
 * Pass the returned function as `fetchImpl` to `ProviderRegistry` or
 * individual provider constructors.
 *
 * @param fetchImpl - Underlying fetch implementation (default: globalThis.fetch)
 * @returns A fetch function that enforces loopback-only access
 */
export function createAirGappedFetch(
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): typeof fetch {
  const airGappedFetch = async (
    input: URL | Request | string,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (!isLocalUrl(url)) {
      throw new AirGapBlockedError(url);
    }

    return fetchImpl(input, init);
  };

  return airGappedFetch as unknown as typeof fetch;
}

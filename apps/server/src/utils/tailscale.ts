/**
 * Detect Tailscale network interface and return the Tailscale IP.
 *
 * Phase 27: Used at server startup to print a Tailscale connect URL
 * for remote access. Returns null if Tailscale is not running.
 *
 * ## How it works
 *
 * Checks `ip addr show tailscale0` (Linux) or the `tailscale ip` CLI.
 * Returns the first IPv4 address found on the tailscale interface.
 */
export function detectTailscaleIp(): string | null {
  try {
    // Try `ip addr show tailscale0` first (Linux/WSL)
    const output = Bun.spawnSync(["ip", "addr", "show", "tailscale0"], {
      stderr: "pipe",
    });
    if (output.exitCode === 0) {
      const text = output.stdout.toString();
      // Look for inet addr like "inet 100.81.83.98/24"
      const match = text.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match?.[1]) {
        return match[1];
      }
    }
  } catch {
    // ip command not available or interface not found
  }

  try {
    // Try `tailscale ip` CLI (cross-platform)
    const output = Bun.spawnSync(["tailscale", "ip", "--4"], {
      stderr: "pipe",
    });
    if (output.exitCode === 0) {
      const ip = output.stdout.toString().trim();
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        return ip;
      }
    }
  } catch {
    // tailscale CLI not available
  }

  return null;
}

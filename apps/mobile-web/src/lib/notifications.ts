/**
 * Browser notification helpers for permission prompts.
 *
 * When the tab is backgrounded and a permission prompt fires, this module
 * shows a native browser notification (if the user has granted permission).
 *
 * Phase 20B requirement: "Permission prompt appears as browser notification
 * when tab is backgrounded."
 */

/**
 * Request notification permission from the browser.
 * Returns true if granted, false otherwise.
 * Call this once early in the app lifecycle (e.g., on user interaction).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.log("[notifications] Not supported in this browser");
    return false;
  }

  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;

  try {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  } catch {
    // Some browsers throw if called outside a user gesture
    return false;
  }
}

/**
 * Show a notification for a permission prompt.
 * Silently returns false if notifications aren't available or permitted.
 */
export function notifyPermissionRequest(
  action: string,
  details?: string,
): boolean {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;

  // Only notify if the tab is backgrounded (no need if user is looking)
  if (document.visibilityState !== "hidden") return false;

  try {
    const n = new Notification("🔐 Permission Required", {
      body: details
        ? `${action}: ${details.slice(0, 120)}`
        : `${action} — tap to open agent-workbench`,
      tag: "permission-prompt",
      requireInteraction: true,
      icon: "/icons/icon-192.png",
    });

    n.addEventListener("click", () => {
      window.focus();
      n.close();
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Show a notification for an error event while backgrounded.
 */
export function notifyError(summary: string, details?: string): boolean {
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  if (document.visibilityState !== "hidden") return false;

  try {
    new Notification("⚠️ agent-workbench", {
      body: details ? `${summary}: ${details.slice(0, 100)}` : summary,
      tag: "error-alert",
      icon: "/icons/icon-192.png",
    });
    return true;
  } catch {
    return false;
  }
}

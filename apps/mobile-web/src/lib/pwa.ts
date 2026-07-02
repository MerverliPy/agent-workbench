import { createSignal } from "solid-js";

// PWA install prompt state (Chrome/Edge only — iOS uses manual "Add to Home Screen")
const [installReady, setInstallReady] = createSignal(false);
const [deferredPrompt, setDeferredPrompt] = createSignal<BeforeInstallPromptEvent | null>(null);

/** Reactive signal: true when the browser fires beforeinstallprompt */
export function useInstallReady(): () => boolean {
  return installReady;
}

/** Trigger the native install prompt (Chrome/Edge). iOS users must use Share → Add to Home Screen. */
export async function triggerInstall(): Promise<boolean> {
  const prompt = deferredPrompt();
  if (!prompt) return false;
  prompt.prompt();
  const result = await prompt.userChoice;
  setDeferredPrompt(null);
  setInstallReady(false);
  return result.outcome === "accepted";
}

/** Register the service worker. Call once from index.tsx on app startup. */
export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  // Listen for install prompt event (Chrome/Edge)
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
    setInstallReady(true);
  });

  // Track install completion
  window.addEventListener("appinstalled", () => {
    setDeferredPrompt(null);
    setInstallReady(false);
  });

  // Register the service worker from Vite's build output
  navigator.serviceWorker
    .register("/sw.js", { scope: "/" })
    .then((registration) => {
      console.log("[pwa] Service worker registered:", registration.scope);

      // Handle updates
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[pwa] Update available — will activate on reload");
          }
        });
      });
    })
    .catch((err) => {
      console.warn("[pwa] Service worker registration failed:", err);
    });
}

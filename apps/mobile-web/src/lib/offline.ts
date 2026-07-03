import { createSignal, onMount } from "solid-js";

/**
 * Tracks online/offline status for the mobile-web PWA.
 * Returns a reactive signal and a convenience boolean accessor.
 */
let _listenersInitialized = false;
const [isOnline, setIsOnline] = createSignal(navigator.onLine);

export function initOfflineDetection(): void {
  if (_listenersInitialized) return;
  _listenersInitialized = true;

  const handleOnline = (): void => {
    setIsOnline(true);
  };
  const handleOffline = (): void => {
    setIsOnline(false);
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
}

/**
 * Reactive signal: true when the browser reports an active network connection.
 * Re-renders all subscribers on online/offline transitions.
 */
export function useOnline(): () => boolean {
  onMount(() => {
    initOfflineDetection();
  });

  // Re-subscribe reactivity — Solid tracks signal reads.
  return isOnline;
}

/**
 * Imperative check — returns current status without reactive tracking.
 */
export function getOnlineStatus(): boolean {
  return navigator.onLine;
}

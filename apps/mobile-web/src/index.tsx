import { render } from "solid-js/web";
import { App } from "./App";
import { registerServiceWorker } from "./lib/pwa";
import { initOfflineDetection } from "./lib/offline";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

// Initialize offline detection for banner
initOfflineDetection();

// Register PWA service worker for offline caching
registerServiceWorker();

render(() => <App />, root);

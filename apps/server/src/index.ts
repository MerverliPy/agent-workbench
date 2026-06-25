import { createApp } from "./app";
import { getServerConfig } from "./config";

const config = getServerConfig();
const app = createApp({ config });

console.log(`[server] Binding to http://${config.host}:${config.port}`);

export default {
  port: config.port,
  hostname: config.host,
  fetch: app.fetch,
};

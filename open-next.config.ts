import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Keep the Node.js/Electron build as the default. This adapter is invoked only
// by the explicit cloudflare:* scripts and produces a separate .open-next tree.
export default defineCloudflareConfig();

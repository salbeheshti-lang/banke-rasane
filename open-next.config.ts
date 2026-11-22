// The Cloudflare adapter is installed only by the dedicated preview workflow.
// @ts-ignore -- keep the regular Windows/Linux CI independent of this optional adapter.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();

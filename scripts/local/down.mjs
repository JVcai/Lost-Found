import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const config = fileURLToPath(
  new URL("../../.local-supabase/compose.json", import.meta.url),
);
execFileSync(
  "docker",
  [
    "compose",
    "-p",
    process.env.LOSTNET_LOCAL_PROJECT || "lostnet-test",
    "-f",
    config,
    "down",
  ],
  { stdio: "inherit" },
);
// Named volumes are retained. No user data is removed.

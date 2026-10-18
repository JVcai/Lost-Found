// Development-only local Supabase components. No hosted projects are changed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { root, local, dbPassword } from "./prepare.mjs";
const args = [
  "compose",
  "-p",
  process.env.LOSTNET_LOCAL_PROJECT || "lostnet-test",
  "-f",
  local + "compose.json",
];
function docker(extra, options = {}) {
  return execFileSync("docker", [...args, ...extra], {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
}
function sql(text, capture = false) {
  return docker(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      ...(capture ? ["-tAc", text] : []),
    ],
    {
      ...(capture
        ? { encoding: "utf8", stdio: "pipe" }
        : { input: text, stdio: ["pipe", "inherit", "inherit"] }),
    },
  );
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function wait(check, name) {
  for (let i = 0; i < 90; i++) {
    try {
      if (await check()) return;
    } catch {}
    await pause(1000);
  }
  throw new Error(name + " did not become ready. Inspect docker compose logs.");
}
docker(["up", "-d", "db"]);
await wait(() => {
  docker(
    ["exec", "-T", "db", "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
    { stdio: "ignore" },
  );
  return true;
}, "Database");
sql(
  readFileSync(new URL("bootstrap.sql", import.meta.url), "utf8") +
    `\nalter role authenticator password '${dbPassword}';\n`,
);
docker(["up", "-d", "auth", "rest", "storage"]);
await wait(async () => {
  const r = await fetch("http://127.0.0.1:54329/health");
  return r.ok;
}, "Auth");
await wait(async () => {
  const r = await fetch("http://127.0.0.1:54327/status");
  return r.ok;
}, "Storage");
const existing =
  sql("select to_regclass('public.reports') is not null", true).trim() === "t";
if (!existing) {
  sql(readFileSync(root + "database/migrations/001_initial.sql", "utf8"));
  sql(readFileSync(root + "database/seed.sql", "utf8"));
}
sql(
  readFileSync(
    root + "database/migrations/002_gps_and_match_reconciliation.sql",
    "utf8",
  ),
);
sql(
  readFileSync(root + "database/migrations/003_matching_evidence.sql", "utf8"),
);
sql(
  "grant usage on schema storage to service_role;grant all on all tables in schema storage to service_role;NOTIFY pgrst, 'reload schema';",
);
console.log(
  "Local development services ready. Existing .env files were preserved. Start local:gateway, dev:api and dev:mobile in separate terminals. This fixture has no Realtime, SMTP or external AI/push configuration.",
);

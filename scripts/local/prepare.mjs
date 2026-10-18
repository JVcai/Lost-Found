import { randomBytes, createHmac } from "node:crypto";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const local = root + ".local-supabase/";
mkdirSync(local, { recursive: true });
const previous = existsSync(local + "runtime.json")
  ? JSON.parse(readFileSync(local + "runtime.json", "utf8"))
  : null;
const secret = previous?.secret || randomBytes(32).toString("hex");
const dbPassword = previous?.dbPassword || randomBytes(32).toString("hex");
const jwt = (role) => {
  const a = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    b = Buffer.from(
      JSON.stringify({
        role,
        iss: "supabase",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 10 * 365 * 86400,
      }),
    ).toString("base64url");
  return `${a}.${b}.${createHmac("sha256", secret).update(`${a}.${b}`).digest("base64url")}`;
};
const anon = jwt("anon"),
  service = jwt("service_role");
writeFileSync(
  local + "runtime.json",
  JSON.stringify({ secret, anon, service, dbPassword }),
  { mode: 0o600 },
);
writeFileSync(
  local + "compose.json",
  JSON.stringify(
    {
      services: {
        db: {
          image:
            "postgis/postgis@sha256:3f4a5d48e0be9580ed70ed618cd039ce57bbb2dd113053d3836e28513f1f87cd",
          environment: { POSTGRES_PASSWORD: dbPassword },
          command: ["postgres", "-c", "wal_level=logical"],
          volumes: ["db-data:/var/lib/postgresql/data"],
          healthcheck: {
            test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -U postgres"],
            interval: "2s",
            retries: 20,
          },
        },
        auth: {
          image:
            "supabase/gotrue@sha256:f2112b9289422f205df4ea15b8b550d425ae42528ea54521faa32cc7b62490de",
          ports: ["127.0.0.1:54329:9999"],
          environment: {
            GOTRUE_API_HOST: "0.0.0.0",
            GOTRUE_API_PORT: "9999",
            API_EXTERNAL_URL: "http://127.0.0.1:54321/auth/v1",
            GOTRUE_DB_DRIVER: "postgres",
            GOTRUE_DB_DATABASE_URL: `postgres://postgres:${dbPassword}@db:5432/postgres?search_path=auth`,
            GOTRUE_DB_NAMESPACE: "auth",
            GOTRUE_SITE_URL: "http://localhost:5173",
            GOTRUE_JWT_SECRET: secret,
            GOTRUE_JWT_AUD: "authenticated",
            GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
            GOTRUE_JWT_ADMIN_ROLES: "service_role",
            GOTRUE_MAILER_AUTOCONFIRM: "true",
            GOTRUE_DISABLE_SIGNUP: "false",
          },
          depends_on: { db: { condition: "service_healthy" } },
        },
        rest: {
          image:
            "postgrest/postgrest@sha256:7c5840727ad683b0fdbfb9810930665b34f8b44884a4dc740aa8844748a2b85e",
          ports: ["127.0.0.1:54328:3000"],
          environment: {
            PGRST_DB_URI: `postgres://authenticator:${dbPassword}@db:5432/postgres`,
            PGRST_DB_SCHEMAS: "public",
            PGRST_DB_ANON_ROLE: "anon",
            PGRST_JWT_SECRET: secret,
            PGRST_DB_EXTRA_SEARCH_PATH: "public,extensions",
          },
          depends_on: { db: { condition: "service_healthy" } },
        },
        storage: {
          image:
            "supabase/storage-api@sha256:5a3ecdc67dbe9e88a56810b5b2f432f2d93708dcb4dc9de34e78e342b390eb4d",
          ports: ["127.0.0.1:54327:5000"],
          environment: {
            ANON_KEY: anon,
            SERVICE_KEY: service,
            PGRST_JWT_SECRET: secret,
            JWT_SECRET: secret,
            DATABASE_URL: `postgres://postgres:${dbPassword}@db:5432/postgres`,
            POSTGREST_URL: "http://rest:3000",
            FILE_SIZE_LIMIT: "10485760",
            STORAGE_BACKEND: "file",
            FILE_STORAGE_BACKEND_PATH: "/var/lib/storage",
            TENANT_ID: "local",
            REGION: "local",
            GLOBAL_S3_BUCKET: "local",
            ENABLE_IMAGE_TRANSFORMATION: "false",
          },
          volumes: ["storage-data:/var/lib/storage"],
          depends_on: { db: { condition: "service_healthy" } },
        },
      },
      volumes: { "db-data": {}, "storage-data": {} },
    },
    null,
    2,
  ),
  { mode: 0o600 },
);

for (const [app, text] of Object.entries({
  backend: `SUPABASE_URL=http://127.0.0.1:54321\nSUPABASE_ANON_KEY=${anon}\nSUPABASE_SERVICE_ROLE_KEY=${service}\nPORT=3000\n`,
  admin: `VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_ANON_KEY=${anon}\nVITE_API_URL=http://localhost:3000\n`,
  mobile: `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321\nEXPO_PUBLIC_SUPABASE_ANON_KEY=${anon}\nEXPO_PUBLIC_API_URL=http://localhost:3000\n`,
})) {
  if (!existsSync(root + app + "/.env"))
    writeFileSync(root + app + "/.env", text, { mode: 0o600, flag: "wx" });
}
export { root, local, dbPassword };

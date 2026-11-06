// EAS build hook: report variable names only, never their values or keys.
const errors = [];
for (const name of ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_SUPABASE_URL"]) {
  try {
    const url = new URL(process.env[name] || "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(url.hostname)
    )
      throw new Error();
  } catch {
    errors.push(
      `${name} must be a reachable HTTPS service URL, not localhost. Set it in the EAS preview environment.`,
    );
  }
}
if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim())
  errors.push(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY is missing from the EAS preview environment.",
  );
if (errors.length) {
  console.error("APK configuration is incomplete:\n" + errors.join("\n"));
  process.exit(1);
}
console.log(
  "APK public configuration is present and uses HTTPS. Service reachability still needs verification from the phone.",
);

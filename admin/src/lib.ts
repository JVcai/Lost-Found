import { createClient } from "@supabase/supabase-js";
const env = (import.meta as any).env;
export const configured = Boolean(
  env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY,
);
export const supabase = configured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;
export const apiBase = env.VITE_API_URL || "http://localhost:3000";
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = (await supabase?.auth.getSession())?.data.session;
  const res = await fetch(apiBase + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res
    .json()
    .catch(() => ({ message: "Server unavailable" }));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

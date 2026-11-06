import "react-native-url-polyfill/auto";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
// Refresh tokens stay in iOS Keychain / Android Keystore.
const storage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};
export const supabase = configured
  ? createClient(url!, key!, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export const useSession = create<{
  session: Session | null;
  setSession: (s: Session | null) => void;
}>((set) => ({ session: null, setSession: (session) => set({ session }) }));
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  if (!base)
    throw new Error(
      "API address is missing from this build. Set EXPO_PUBLIC_API_URL in the EAS preview environment and rebuild the APK.",
    );
  let endpoint: URL;
  try {
    endpoint = new URL(base);
  } catch {
    throw new Error(
      "Invalid API address. Check EXPO_PUBLIC_API_URL and rebuild the APK.",
    );
  }
  if (
    !["http:", "https:"].includes(endpoint.protocol) ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new Error(
      "API address must be a plain HTTP(S) URL without credentials, query or fragment.",
    );
  if (
    ["localhost", "127.0.0.1", "[::1]", "0.0.0.0"].includes(endpoint.hostname)
  )
    throw new Error(
      "API address points to the phone itself (localhost). Use a reachable server address and rebuild the APK.",
    );
  const session = (await supabase?.auth.getSession())?.data.session;
  let res: Response;
  try {
    res = await fetch(base + path, {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      endpoint.protocol === "http:"
        ? "Cannot reach the API. This build uses HTTP, which Android APKs may block. Use a reachable HTTPS backend URL in EAS preview and rebuild. Expo tunnel does not expose the backend."
        : "Cannot reach the API. Check that the backend is running and its /health URL opens in this phone's browser. If the build address is wrong, update EAS preview and rebuild.",
    );
  }
  const data = await res
    .json()
    .catch(() => ({ message: "Server unavailable" }));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

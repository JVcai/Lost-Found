import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL,
  key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
// Native refresh tokens are stored in Keychain / Android Keystore. Web sessions are memory-only.
const memory = new Map<string, string>();
const storage = {
  getItem: (k: string) =>
    Platform.OS === "web"
      ? Promise.resolve(memory.get(k) || null)
      : SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) =>
    Platform.OS === "web"
      ? Promise.resolve(void memory.set(k, v))
      : SecureStore.setItemAsync(k, v),
  removeItem: (k: string) =>
    Platform.OS === "web"
      ? Promise.resolve(void memory.delete(k))
      : SecureStore.deleteItemAsync(k),
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
  const session = (await supabase?.auth.getSession())?.data.session;
  const res = await fetch(
    (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000") + path,
    {
      ...options,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...options.headers,
      },
    },
  );
  const data = await res
    .json()
    .catch(() => ({ message: "Server unavailable" }));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

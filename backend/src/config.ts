import "dotenv/config";
import { z } from "zod";
export function loadConfig() {
  return z
    .object({
      SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
      SUPABASE_ANON_KEY: z.string().min(1),
      GEMINI_API_KEY: z.string().optional(),
      GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
      EXPO_PUSH_ACCESS_TOKEN: z.string().optional(),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      CORS_ORIGINS: z.string().default(""),
    })
    .parse(process.env);
}
export type Config = ReturnType<typeof loadConfig>;

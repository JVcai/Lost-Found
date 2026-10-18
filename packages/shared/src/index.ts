import { z } from "zod";
export const categories = [
  "Bags",
  "Electronics",
  "Keys",
  "Wallets",
  "Documents",
  "Clothing",
  "Jewelry",
  "Other",
] as const;
export const reportSchema = z
  .object({
    type: z.enum(["LOST", "FOUND"]),
    category: z.enum(categories),
    item_name: z.string().trim().min(2).max(120),
    brand: z.string().trim().max(100).default(""),
    color: z.string().trim().min(1).max(60),
    description: z.string().trim().max(2000).default(""),
    unique_features: z
      .array(z.string().trim().min(1).max(200))
      .max(20)
      .default([]),
    location_id: z.uuid(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    event_at: z.iso
      .datetime({ offset: true })
      .refine(
        (v) => Date.parse(v) <= Date.now() + 300000,
        "Date cannot be in the future",
      ),
    reward: z.number().min(0).max(1000000).default(0),
    storage_location: z.string().trim().max(200).default(""),
  })
  .refine(
    (v) => (v.latitude === undefined) === (v.longitude === undefined),
    "Provide both coordinates",
  );
export type ReportInput = z.infer<typeof reportSchema>;
export type Report = ReportInput & {
  id: string;
  user_id: string;
  organization_id: string;
  status: string;
  created_at: string;
  location_name?: string;
  image_url?: string;
  ai_description?: string;
  ai_features?: string[];
};
export type Match = {
  viewer_is_owner?: boolean;
  id: string;
  lost_report_id: string;
  found_report_id: string;
  visual_score: number;
  location_score: number;
  time_score: number;
  feature_score: number;
  total_score: number;
  status: string;
  lost?: Report;
  found?: Report;
};
export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(2).max(100),
});

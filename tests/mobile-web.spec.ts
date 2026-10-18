import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
test("Expo web: real sign-in and bottom navigation", async ({ page }) => {
  test.skip(
    process.env.LIVE_BROWSER !== "true",
    "Requires configured Expo Metro and disposable local services",
  );
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const email = `mobile-${crypto.randomUUID()}@example.com`,
    password = crypto.randomUUID() + "Aa9!";
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Mobile Test" },
  });
  if (error) throw error;
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:8081");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in →", exact: true }).click();
    await expect(
      page.getByText("Let’s bring things home.", { exact: true }),
    ).toBeVisible();
    await page.getByText("Reports", { exact: true }).click();
    await expect(page.getByText("My reports", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "＋ Lost item", exact: true })
      .click();
    await expect(
      page.getByText("Report a lost item", { exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await db.auth.admin.deleteUser(data.user!.id);
  }
});

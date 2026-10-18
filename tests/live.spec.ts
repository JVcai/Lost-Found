import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";
test("connected browser: sign in, create report, reload and staff scope", async ({
  page,
}) => {
  test.skip(
    process.env.LIVE_BROWSER !== "true",
    "Requires a disposable configured Supabase project and API",
  );
  const db = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const email = `browser-${crypto.randomUUID()}@example.com`,
    password = crypto.randomUUID() + "Aa9!";
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Alex Browser" },
  });
  if (error) throw error;
  const user = data.user!;
  try {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const location = await db
      .from("locations")
      .select("id,organization_id")
      .limit(1)
      .single();
    if (location.error) throw location.error;
    await db.from("staff_members").insert({
      user_id: user.id,
      organization_id: location.data.organization_id,
      role: "STAFF",
    });
    await page.goto("http://localhost:5173");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Let’s bring things home, Alex." }),
    ).toBeVisible();
    await page.screenshot({
      path: "/workspace/lostnet-connected.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "I lost something", exact: false })
      .click();
    await page
      .getByLabel("Item name *", { exact: true })
      .fill("Browser acceptance backpack");
    await page
      .getByRole("combobox", { name: "Category *", exact: true })
      .selectOption("Bags");
    await page.getByLabel("Color *", { exact: true }).fill("Black");
    await page
      .getByRole("combobox", { name: "Location *", exact: true })
      .selectOption(location.data.id);
    await page
      .getByLabel("Date and time *", { exact: true })
      .fill(new Date(Date.now() - 3600000).toISOString().slice(0, 16));
    await page
      .getByRole("button", { name: "Submit report", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "My reports", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Browser acceptance backpack" }),
    ).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "My reports", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Browser acceptance backpack" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Staff desk", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Organization reports" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    const reports = await db
      .from("reports")
      .select("id")
      .eq("user_id", user.id);
    for (const r of reports.data || [])
      await db.from("reports").delete().eq("id", r.id);
    await db.from("audit_logs").delete().eq("actor_id", user.id);
    await db.from("staff_members").delete().eq("user_id", user.id);
    await db.auth.admin.deleteUser(user.id);
  }
});

import { test, expect } from "@playwright/test";
test("setup screen explains required configuration without fake data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:5173");
  await expect(page.getByText("A home for everything")).toBeVisible();
  await expect(
    page.getByText("Create your Supabase project", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Service-role and Gemini keys belong only on the server."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile viewport has accessible navigation and fits the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:5173");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(
    page.getByRole("button", { name: "My reports", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "My reports", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

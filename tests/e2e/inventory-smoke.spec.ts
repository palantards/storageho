import { expect, test } from "@playwright/test";

test("signup -> create inventory -> search -> move", async ({ page }) => {
  const suffix = Date.now();
  const email = process.env.E2E_EMAIL || `smoke+${suffix}@example.com`;
  const password = process.env.E2E_PASSWORD || "SmokePass123!";

  await page.goto("/en/register");

  await page.getByLabel("Name").fill("Smoke User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL(/\/en\/dashboard/);

  await page.getByLabel("Household name").fill("Smoke Household");
  await page.getByRole("button", { name: /create household/i }).click();

  await expect(page.getByText("Quick Add Location")).toBeVisible();
  await page.getByPlaceholder("Basement storage").fill("Apartment");
  await page.getByRole("button", { name: /add location/i }).click();

  await page.getByRole("link", { name: "Locations" }).first().click();
  await page.getByRole("link", { name: "Open" }).first().click();

  await page.getByPlaceholder("Kitchen").fill("Storage Room");
  await page.getByRole("button", { name: /add room/i }).click();
  await page.getByRole("link", { name: "Open Room" }).first().click();

  await page.getByPlaceholder("Box A").fill("Box One");
  await page.getByPlaceholder("A-01").fill("BOX-1");
  await page.getByRole("button", { name: /add container/i }).click();

  await page.getByPlaceholder("Box A").fill("Box Two");
  await page.getByPlaceholder("A-01").fill("BOX-2");
  await page.getByRole("button", { name: /add container/i }).click();

  await page.getByRole("link", { name: "Open Box" }).first().click();

  await page.getByPlaceholder("Item name").fill("Winter Jacket");
  await page.getByRole("button", { name: /create and add/i }).click();
  await expect(page.getByText("Winter Jacket")).toBeVisible();

  await page.getByRole("button", { name: "Move" }).first().click();
  await page.getByLabel("Destination Box").click();
  await page.getByRole("option", { name: "Box Two" }).click();
  await page.getByRole("button", { name: /^Move$/ }).click();

  await expect(page.getByText("History")).toBeVisible();

  await page.getByRole("button", { name: /search/i }).click();
  await page.getByPlaceholder(/search items/i).fill("Winter");
  await expect(page.getByText("Winter Jacket")).toBeVisible();
});
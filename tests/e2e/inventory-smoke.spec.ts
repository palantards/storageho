import { expect, test } from "@playwright/test";

const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
  "base64",
);

test("signup -> onboarding -> scan -> suggestions -> search -> map", async ({ page }) => {
  const suffix = Date.now();
  const email = process.env.E2E_EMAIL || `v2-smoke+${suffix}@example.com`;
  const password = process.env.E2E_PASSWORD || "SmokePass123!";

  await page.goto("/en/register");
  await page.getByLabel("Name").fill("StorageHo V2 User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/\/en\/dashboard/);

  await page.goto("/en/onboarding");

  const createHouseholdButton = page.getByRole("button", { name: "Create household" });
  if (await createHouseholdButton.isVisible()) {
    await page.getByLabel("Household name").fill("V2 Household");
    await createHouseholdButton.click();
  }

  await expect(page.getByText("StorageHo onboarding")).toBeVisible();

  const locationForm = page.locator("form").filter({
    has: page.getByPlaceholder("Basement storage"),
  });
  await locationForm.getByPlaceholder("Basement storage").fill("V2 Basement");
  await locationForm.getByRole("button", { name: "Create" }).click();

  await page.getByRole("button", { name: "Apply template" }).first().click();

  await page.getByPlaceholder("Winter Gear Box").fill("Scan Box");
  await page.getByPlaceholder("WG-01").fill("SCAN-01");
  await page.getByRole("button", { name: "Create box" }).click();

  await page.getByRole("link", { name: "Go to Scan Mode" }).click();
  await expect(page.getByText("Scan Mode")).toBeVisible();

  await page
    .getByPlaceholder("2 HDMI cables, 1 powerbank")
    .fill("2 HDMI cables, 1 powerbank");
  await page.getByRole("button", { name: "Add to box" }).click();
  await expect(page.getByText(/Added .* entries/)).toBeVisible();

  await page
    .locator("input[type='file']")
    .first()
    .setInputFiles({
      name: "box.png",
      mimeType: "image/png",
      buffer: tinyPng,
    });

  await page.request.get("/api/jobs/run?limit=10");
  await page.reload();

  await expect(page.getByText("AI suggestions")).toBeVisible();
  const acceptButtons = page.getByRole("button", { name: "Accept" });
  if ((await acceptButtons.count()) > 0) {
    await acceptButtons.first().click();
  }

  await page.getByRole("button", { name: /search/i }).click();
  await page.getByPlaceholder(/search items/i).fill("HDMI");
  await expect(page.getByText("HDMI")).toBeVisible();
  await page.getByText("HDMI").first().click();

  await page.goto("/en/scan");
  await page.getByRole("link", { name: "Open full box page" }).click();
  await expect(page.getByRole("tab", { name: "Map" })).toBeVisible();
  await page.getByRole("tab", { name: "Map" }).click();
  await page.getByRole("link", { name: "Open room map" }).click();

  await expect(page.getByText(/Room map:/)).toBeVisible();
  await page.getByRole("button", { name: /Place|Move/ }).first().click();
  await expect(page.getByText("Placement saved.")).toBeVisible();

  await page.goto("/en/canvas");
  await expect(page.getByText("Household setup")).toBeVisible();
  await expect(page.getByText("Read-only map")).toBeVisible();

  await page.getByPlaceholder("New floor name").fill("Top Floor");
  await page.getByRole("button", { name: "+ Floor" }).click();
  await expect(page.getByRole("option", { name: "Top Floor" })).toBeVisible();

  await page.getByPlaceholder("Create room").fill("Closet");
  await page.getByRole("button", { name: "Add room" }).click();
  await expect(page.getByRole("option", { name: "Closet" })).toBeVisible();

  await page.getByPlaceholder("Container name").fill("Canvas Flow Box");
  await page.getByTestId("setup-create-container").click();
  await expect(page.getByTestId("setup-post-create-panel")).toBeVisible();
  await expect(page.getByText("Container created: Canvas Flow Box")).toBeVisible();

  await page
    .getByTestId("setup-post-create-panel")
    .locator("input[type='file']")
    .setInputFiles({
      name: "setup-box.png",
      mimeType: "image/png",
      buffer: tinyPng,
    });
  await page.request.get("/api/jobs/run?limit=10");
  await page.reload();
  await expect(page.getByText("Read-only map")).toBeVisible();
  await expect(page.getByTestId("household-readonly-map")).toBeVisible();
});

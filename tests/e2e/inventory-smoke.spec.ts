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
  await expect(page.getByText("Home Builder")).toBeVisible();

  const viewport = page.getByTestId("household-canvas-viewport");
  await viewport.hover();
  const zoomValue = page.getByTestId("canvas-zoom-value");
  await expect(zoomValue).toHaveText("100%");
  await page.mouse.wheel(0, -700);
  await expect(zoomValue).not.toHaveText("100%");

  await page.getByRole("button", { name: "Triangle room" }).click();
  const grid = page.getByTestId("household-canvas-grid");
  const box = await grid.boundingBox();
  if (!box) throw new Error("Expected household canvas grid bounding box");
  await page.mouse.move(box.x + 140, box.y + 140);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 260);
  await page.mouse.up();
  await expect(grid.getByText("(triangle)")).toBeVisible();

  await page.getByRole("button", { name: "Tap to add box" }).click();
  await page.mouse.click(box.x + 220, box.y + 220);
  await expect(page.getByText("Box actions")).toBeVisible();
  await page.getByPlaceholder("Box name").fill("Canvas box");
  await page.getByRole("button", { name: "Create + place" }).click();
  await expect(grid.getByText("Canvas box")).toBeVisible();
});

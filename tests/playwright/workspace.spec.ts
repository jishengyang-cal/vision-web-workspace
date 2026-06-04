import { expect, test } from "@playwright/test";

test("workspace opens and can create a terminal window through the gateway", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Vision Web Workspace")).toBeVisible();
  await expect(page.locator(".spatial-window")).toHaveCount(3);

  await page.getByRole("button", { name: "Terminal", exact: true }).click();

  await expect(page.locator(".spatial-window")).toHaveCount(4);
  await expect(page.getByText("Terminal 2")).toBeVisible();
});

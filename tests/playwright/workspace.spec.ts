import { expect, test } from "@playwright/test";

test("workspace opens and can create a terminal window through the gateway", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Vision Web Workspace")).toBeVisible();
  await expect(page.locator(".spatial-window")).toHaveCount(3);

  await page.getByRole("button", { name: "Terminal", exact: true }).click();

  await expect(page.locator(".spatial-window")).toHaveCount(4);
  await expect(page.getByText("Terminal 2")).toBeVisible();
});

test("window chrome can create, minimize, and restore browser-like windows", async ({ page }) => {
  await page.goto("/");

  const terminalWindow = page.locator(".spatial-window").filter({ hasText: "Terminal" }).first();
  const initialRect = await terminalWindow.evaluate((element) => ({
    left: Number((element as HTMLElement).style.left.replace("px", "")),
    top: Number((element as HTMLElement).style.top.replace("px", "")),
    width: Number((element as HTMLElement).style.width.replace("px", "")),
    height: Number((element as HTMLElement).style.height.replace("px", ""))
  }));

  await page.getByRole("button", { name: "New window beside Terminal", exact: true }).click();
  await expect(page.getByText("Terminal 2")).toBeVisible();

  const newTerminalWindow = page.locator(".spatial-window").filter({ hasText: "Terminal 2" }).first();
  const newRect = await newTerminalWindow.evaluate((element) => ({
    left: Number((element as HTMLElement).style.left.replace("px", "")),
    top: Number((element as HTMLElement).style.top.replace("px", "")),
    width: Number((element as HTMLElement).style.width.replace("px", "")),
    height: Number((element as HTMLElement).style.height.replace("px", ""))
  }));

  expect(newRect.left).toBeGreaterThan(initialRect.left);
  expect(newRect.top).toBe(initialRect.top);
  expect(newRect.width).toBe(initialRect.width);
  expect(newRect.height).toBe(initialRect.height);

  await page.getByRole("button", { name: "Minimize Terminal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore Terminal", exact: true })).toBeVisible();
  await expect(page.locator(".spatial-window")).toHaveCount(3);

  await page.getByRole("button", { name: "Restore Terminal", exact: true }).click();
  await expect(page.locator(".spatial-window")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Restore Terminal", exact: true })).toHaveCount(0);
});

test("gateway exposes native workspace layout and session APIs", async ({ request }) => {
  const layoutResponse = await request.get("http://127.0.0.1:3001/workspaces/local-dev-workspace/layout");
  expect(layoutResponse.ok()).toBeTruthy();
  const layoutPayload = await layoutResponse.json();
  expect(layoutPayload.layout.windows.length).toBeGreaterThan(0);

  const sessionResponse = await request.post("http://127.0.0.1:3001/sessions", {
    data: {
      workspaceId: "local-dev-workspace",
      kind: "browser"
    }
  });
  expect(sessionResponse.ok()).toBeTruthy();
  const sessionPayload = await sessionResponse.json();
  expect(sessionPayload.session.kind).toBe("browser");

  layoutPayload.layout.windows.push({
    id: sessionPayload.session.id,
    title: "Browser from Native",
    kind: "browser",
    url: sessionPayload.session.url,
    rect: { x: 100, y: 100, width: 420, height: 280 },
    minSize: { width: 320, height: 240 },
    zIndex: 9,
    focused: true,
    locked: false
  });

  const saveResponse = await request.put("http://127.0.0.1:3001/workspaces/local-dev-workspace/layout", {
    data: {
      layout: layoutPayload.layout
    }
  });
  expect(saveResponse.ok()).toBeTruthy();
  const saved = await saveResponse.json();
  expect(saved.layout.windows.some((window) => window.id === sessionPayload.session.id)).toBeTruthy();
});

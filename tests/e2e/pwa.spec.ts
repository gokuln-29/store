import { expect, test, type Page } from "@playwright/test";

/**
 * PWA checks. Offline behaviour needs the service worker, which only runs in production
 * builds: run against `pnpm build && pnpm start` (see docs/pwa.md). Tests that need it are
 * skipped on the dev server.
 */

function pngSize(buffer: Buffer): { width: number; height: number } {
  // IHDR chunk: width and height are big-endian at bytes 16 and 20.
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function activateServiceWorker(page: Page): Promise<boolean> {
  await page.goto("/en");
  const active = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    const ready = await Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 8000)),
    ]);
    return ready;
  });
  if (!active) return false;
  // Reload so the page is controlled by the worker (clientsClaim may race the first load).
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10_000 });
  return true;
}

test("the web app manifest and icons come from store settings", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
  const manifest = await res.json();
  expect(manifest).toMatchObject({
    display: "standalone",
    scope: "/",
    start_url: expect.stringMatching(/^\/(en|ta|kn)\?source=pwa$/),
  });
  expect(manifest.name.length).toBeGreaterThan(0);
  expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons as { src: string; sizes: string }[]) {
    const img = await request.get(icon.src);
    expect(img.headers()["content-type"]).toBe("image/png");
    const { width, height } = pngSize(await img.body());
    expect(`${width}x${height}`).toBe(icon.sizes);
  }
  const apple = await request.get("/icons/apple-touch-icon.png");
  expect(pngSize(await apple.body())).toEqual({ width: 180, height: 180 });
  expect((await request.get("/icons/../../.env")).status()).toBe(404);
});

test("the service worker script is served for the whole site", async ({ request }) => {
  const res = await request.get("/serwist/sw.js");
  expect(res.ok()).toBe(true);
  expect(res.headers()["content-type"]).toContain("javascript");
  expect(res.headers()["service-worker-allowed"]).toBe("/");
});

test.describe("offline", () => {
  test("browsed pages and the cart work offline; private pages are never cached", async ({
    page,
    context,
  }) => {
    test.skip(
      !(await activateServiceWorker(page)),
      "Service worker runs only in production builds",
    );

    // Browse a product and put it in the cart while online.
    await page.goto("/en/p/mysore-pak");
    const title = await page.getByRole("heading", { level: 1 }).textContent();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.goto("/en/cart");
    await expect(page.getByText("Mysore Pak").first()).toBeVisible();
    await page.goto("/en/checkout"); // private: must not be cached
    await page.waitForTimeout(500); // let the worker finish writing caches

    await context.setOffline(true);

    await page.goto("/en/p/mysore-pak");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title!);

    await page.goto("/en/cart");
    await expect(page.getByText(/You're offline\. These prices were last checked/)).toBeVisible();
    await expect(page.getByText("Mysore Pak").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Checkout needs a connection" })).toBeDisabled();

    await page.goto("/en/p/filter-coffee-powder"); // never visited
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await page.goto("/ta/c/sweets");
    await expect(
      page.getByRole("heading", { name: "நீங்கள் ஆஃப்லைனில் உள்ளீர்கள்" }),
    ).toBeVisible();
    await page.goto("/en/checkout");
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();

    const cached = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) urls.push(new URL(req.url).pathname);
      }
      return urls;
    });
    expect(cached).toContain("/en/p/mysore-pak");
    expect(
      cached.filter((u) =>
        /\/(admin|checkout|account|login|order)(\/|$)|^\/api\/(auth|admin|orders|cart)/.test(u),
      ),
    ).toEqual([]);

    await context.setOffline(false);
    await page.goto("/en/cart");
    await expect(page.getByRole("link", { name: "Checkout" })).toBeVisible();
    await expect(page.getByText(/You're offline/)).toHaveCount(0);
  });
});

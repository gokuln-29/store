import { describe, expect, it } from "vitest";
import { ORDER_TEMPLATES, renderOrderNotification } from "@/lib/notifications/render";

const payload = {
  storeName: "Demo <Store>",
  brandColor: "#123456",
  orderNumber: "DS-1001",
  customerName: "Asha",
  total: "₹309",
  orderUrl: "https://shop.example/en/account/orders/DS-1001",
  courierName: "Delhivery",
  trackingNumber: "TRK123",
  trackingUrl: "https://track.example/TRK123",
};

describe("order notification templates", () => {
  it("renders every template in every language", () => {
    for (const locale of ["en", "ta", "kn"]) {
      for (const template of ORDER_TEMPLATES) {
        const m = renderOrderNotification(template, locale, payload);
        expect(m.subject).toContain("DS-1001");
        expect(m.text).toContain("DS-1001");
        expect(m.short).toContain("DS-1001");
        expect(m.html).toContain(`lang="${locale}"`);
      }
    }
  });

  it("escapes HTML and includes tracking for shipped orders", () => {
    const m = renderOrderNotification("order_shipped", "en", payload);
    expect(m.html).toContain("Demo &lt;Store&gt;");
    expect(m.html).not.toContain("Demo <Store>");
    expect(m.text).toContain("Tracking number: TRK123");
    expect(m.html).toContain('href="https://track.example/TRK123"');
    expect(m.short).toContain("https://track.example/TRK123");
  });

  it("drops unsafe tracking links", () => {
    const m = renderOrderNotification("order_shipped", "en", {
      ...payload,
      trackingUrl: "javascript:alert(1)",
    });
    expect(m.html).not.toContain("javascript:");
    expect(m.short).toContain(payload.orderUrl);
  });

  it("mentions the refund only when there is one", () => {
    expect(renderOrderNotification("order_cancelled", "en", payload).text).not.toMatch(/refund/i);
    expect(
      renderOrderNotification("order_cancelled", "en", { ...payload, refund: true }).text,
    ).toMatch(/refunded/);
  });
});

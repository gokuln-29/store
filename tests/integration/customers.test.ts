import Papa from "papaparse";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  exportCustomersCsv,
  exportOrdersCsv,
  getCustomer,
  listCustomers,
} from "@/lib/services/customer.service";

let admin: string;
let seq = 0;

beforeEach(async () => {
  admin = (await db.user.create({ data: { email: "owner@x.in", role: "OWNER" } })).id;
});

async function customer(name: string, phone: string, orders: [number, string][]) {
  const user = await db.user.create({
    data: { name, phone, role: "CUSTOMER", email: `${phone.slice(-4)}@x.in` },
  });
  for (const [total, status] of orders) {
    seq += 1;
    await db.order.create({
      data: {
        orderNumber: `DS-${3000 + seq}`,
        userId: user.id,
        status: status as "PLACED",
        placedAt: status === "PENDING_PAYMENT" ? null : new Date(Date.UTC(2026, 8, seq)),
        paymentMethod: "COD",
        customerName: name,
        customerPhone: phone,
        shippingAddress: { city: "Chennai", state: "Tamil Nadu", pincode: "600001" },
        subtotal: total,
        total,
        pricesIncludeTax: true,
      },
    });
  }
  return user;
}

describe("customers", () => {
  it("computes lifetime value from placed, not-cancelled orders and sorts by it", async () => {
    const asha = await customer("Asha Rao", "+919800000001", [
      [50000, "DELIVERED"],
      [20000, "PLACED"],
      [99900, "CANCELLED"],
    ]);
    await customer("Bala", "+919800000002", [
      [90000, "SHIPPED"],
      [10000, "PENDING_PAYMENT"],
    ]);
    await customer("Chitra", "+919800000003", []);

    const { rows, total } = await listCustomers({ page: 1, pageSize: 20 });
    expect(total).toBe(3);
    expect(rows.map((r) => [r.name, r.orders, r.ltv])).toEqual([
      ["Bala", 1, 90000],
      ["Asha Rao", 2, 70000],
      ["Chitra", 0, 0],
    ]);
    expect((await listCustomers({ page: 1, pageSize: 20, sort: "orders" })).rows[0]!.name).toBe(
      "Asha Rao",
    );
    expect(
      (await listCustomers({ page: 1, pageSize: 20, q: "98000 00001" })).rows.map((r) => r.name),
    ).toEqual(["Asha Rao"]);
    expect(
      (await listCustomers({ page: 1, pageSize: 20, q: "chit" })).rows.map((r) => r.name),
    ).toEqual(["Chitra"]);

    const detail = await getCustomer(asha.id);
    expect(detail?.stats).toMatchObject({ orders: 2, ltv: 70000 });
    expect(detail?.user.orders).toHaveLength(3); // history shows every order
    expect(await getCustomer(admin)).toBeNull(); // staff aren't customers
  });

  it("exports CSV that matches the database, safely", async () => {
    await customer('=HYPERLINK("http://evil")', "+919800000004", [[12345, "DELIVERED"]]);
    const csv = await exportCustomersCsv(admin);
    expect(csv.startsWith("﻿")).toBe(true);
    const parsed = Papa.parse<string[]>(csv.slice(1).trim()).data;
    expect(parsed[0]).toEqual([
      "Name",
      "Phone",
      "Email",
      "Joined",
      "Orders",
      "Lifetime value (INR)",
      "Last order",
    ]);
    expect(parsed[1]![0]).toBe('\'=HYPERLINK("http://evil")'); // formula neutralised
    expect(parsed[1]!.slice(4, 6)).toEqual(["1", "123.45"]);

    const orders = Papa.parse<string[]>(
      (await exportOrdersCsv(new Date(0), new Date(), admin)).slice(1).trim(),
    ).data;
    expect(orders).toHaveLength(2);
    expect(orders[1]).toEqual(
      expect.arrayContaining(["DELIVERED", "COD", "Chennai", "600001", "123.45"]),
    );
    expect(
      await db.auditLog.count({ where: { action: { in: ["customers.export", "orders.export"] } } }),
    ).toBe(2);
  });
});

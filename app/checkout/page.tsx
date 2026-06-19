"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, hydrateCart, readCartFromStorage, writeCartToStorage } from "@/lib/cart";
import { formatMoney } from "@/lib/products";

type OrderResponse = {
  orderId: string;
};

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [couponStatus, setCouponStatus] = useState("No discount applied.");
  const [displayedTotal, setDisplayedTotal] = useState<number | null>(null);
  const [itemRemovedAfterCoupon, setItemRemovedAfterCoupon] = useState(false);
  const [fatalCouponError, setFatalCouponError] = useState(false);
  const [orderStatus, setOrderStatus] = useState("Ready to place order.");
  const [placedOrders, setPlacedOrders] = useState<string[]>([]);
  const [fastMode, setFastMode] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const storedItems = readCartFromStorage();
      setItems(storedItems);
      setQuantityDrafts(
        Object.fromEntries(storedItems.map((item) => [item.productId, String(item.quantity)])),
      );
      setFastMode(new URLSearchParams(window.location.search).get("fast") === "1");
    });
  }, []);

  const lines = useMemo(() => hydrateCart(items), [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const total = displayedTotal ?? subtotal - (couponApplied ? 10 : 0);

  function persistItems(nextItems: CartItem[]) {
    setItems(nextItems);
    writeCartToStorage(nextItems);
  }

  function updateQuantity(productId: string, value: string) {
    setQuantityDrafts((current) => ({ ...current, [productId]: value }));

    const numericQuantity = Number(value) || 1;
    const nextItems = items.map((item) =>
      item.productId === productId ? { ...item, quantity: numericQuantity } : item,
    );

    persistItems(nextItems);

    if (couponApplied) {
      // Intentional bug #1: after SAVE10 is applied, quantity edits accidentally feed a
      // display label into Number(), making the checkout total become NaN.
      const brokenTotal = Number(`${value} items`) - 10;
      setDisplayedTotal(brokenTotal);
      console.error("QuickCart total calculation failed after coupon quantity edit.", {
        value,
        brokenTotal,
      });
    }
  }

  function removeItem(productId: string) {
    if (couponApplied) {
      setItemRemovedAfterCoupon(true);
    }

    const nextItems = items.filter((item) => item.productId !== productId);
    persistItems(nextItems);
  }

  function applyCoupon() {
    try {
      if (coupon.trim().toUpperCase() !== "SAVE10") {
        setCouponStatus("Coupon not recognized.");
        return;
      }

      if (couponApplied && itemRemovedAfterCoupon) {
        // Intentional bug #2: reapplying a coupon after removing an item tries to use
        // a stale line item and permanently disables checkout.
        const missingLine = lines.find((line) => line.productId === "removed-line");
        if (!missingLine) {
          throw new Error("Stale coupon line item missing.");
        }
      }

      setCouponApplied(true);
      setDisplayedTotal(subtotal - 10);
      setCouponStatus("SAVE10 applied. You saved $10.");
    } catch (error) {
      console.error("QuickCart coupon engine crashed after item removal.", error);
      setFatalCouponError(true);
      setCouponStatus("Coupon engine crashed. Place order is disabled.");
    }
  }

  async function placeOrder() {
    setOrderStatus("Submitting order...");

    // Intentional bug #3: no in-flight lock. Rapid double-clicks send duplicate order
    // requests; ?fast=1 shortens the server delay to make this deterministic on stage.
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        total,
        fast: fastMode,
      }),
    });
    const data = (await response.json()) as OrderResponse;

    setPlacedOrders((current) => {
      const nextOrders = [...current, data.orderId];

      if (nextOrders.length > 1) {
        console.error("Duplicate order detected from rapid checkout clicks.", nextOrders);
        setOrderStatus(`Duplicate orders created: ${nextOrders.join(", ")}`);
      } else {
        setOrderStatus(`Order ${data.orderId} placed.`);
      }

      return nextOrders;
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">
            Checkout
          </p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">Complete your purchase</h1>
          <p className="mt-3 text-slate-600">
            Apply a discount, edit quantities, and place an order. This page intentionally
            contains a few reproducible demo bugs.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {lines.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-600">Your checkout has no items.</p>
              <Link
                className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-white"
                href="/"
              >
                Add products
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lines.map((line) => (
                <div className="grid gap-4 p-6 md:grid-cols-[1fr_auto_auto]" key={line.productId}>
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">{line.name}</h2>
                    <p className="text-slate-600">{formatMoney(line.price)} each</p>
                  </div>
                  <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    Qty
                    <input
                      aria-label={`Quantity for ${line.name}`}
                      className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                      min={1}
                      onChange={(event) => updateQuantity(line.productId, event.target.value)}
                      type="number"
                      value={quantityDrafts[line.productId] ?? String(line.quantity)}
                    />
                  </label>
                  <button
                    className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => removeItem(line.productId)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-950">Order summary</h2>
        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-600">Subtotal</dt>
            <dd className="font-semibold text-slate-950">{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Discount</dt>
            <dd className="font-semibold text-slate-950">{couponApplied ? "-$10.00" : "$0.00"}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-3 text-lg">
            <dt className="font-bold text-slate-950">Total</dt>
            <dd className="font-bold text-slate-950">{formatMoney(total)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex gap-2">
          <input
            aria-label="Coupon code"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
            onChange={(event) => setCoupon(event.target.value)}
            placeholder="SAVE10"
            value={coupon}
          />
          <button
            className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white hover:bg-slate-800"
            onClick={applyCoupon}
            type="button"
          >
            Apply
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">{couponStatus}</p>

        <button
          className="mt-6 w-full rounded-full bg-cyan-500 px-5 py-3 font-bold text-white hover:bg-cyan-600 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={fatalCouponError || lines.length === 0}
          onClick={placeOrder}
          type="button"
        >
          Place order
        </button>
        <p className="mt-3 text-sm text-slate-600">{orderStatus}</p>

        {fastMode ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Demo fast mode is on for deterministic double-click reproduction.
          </p>
        ) : null}

        {placedOrders.length > 0 ? (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <h3 className="font-bold text-slate-950">Created orders</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {placedOrders.map((orderId) => (
                <li key={orderId}>{orderId}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, hydrateCart, readCartFromStorage, writeCartToStorage } from "@/lib/cart";
import { formatMoney } from "@/lib/products";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    queueMicrotask(() => {
      setItems(readCartFromStorage());
    });
  }, []);

  const lines = useMemo(() => hydrateCart(items), [items]);
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  function updateQuantity(productId: string, quantity: number) {
    const nextItems = items.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item,
    );
    setItems(nextItems);
    writeCartToStorage(nextItems);
  }

  function removeItem(productId: string) {
    const nextItems = items.filter((item) => item.productId !== productId);
    setItems(nextItems);
    writeCartToStorage(nextItems);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">Cart</p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">Review your order</h1>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {lines.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-600">Your cart is empty.</p>
            <Link className="mt-4 inline-flex rounded-full bg-slate-950 px-5 py-3 text-white" href="/">
              Continue shopping
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
                    className="w-20 rounded-lg border border-slate-300 px-3 py-2"
                    min={1}
                    onChange={(event) => updateQuantity(line.productId, Number(event.target.value))}
                    type="number"
                    value={line.quantity}
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
      </section>

      <aside className="ml-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between text-lg">
          <span className="font-semibold text-slate-700">Subtotal</span>
          <span className="font-bold text-slate-950">{formatMoney(subtotal)}</span>
        </div>
        <Link
          className="mt-6 block rounded-full bg-cyan-500 px-5 py-3 text-center font-bold text-white hover:bg-cyan-600"
          href="/checkout"
        >
          Checkout
        </Link>
      </aside>
    </div>
  );
}

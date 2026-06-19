"use client";

import Link from "next/link";
import { CART_STORAGE_KEY, defaultCart, readCartFromStorage, writeCartToStorage } from "@/lib/cart";
import { formatMoney, products } from "@/lib/products";

export default function StorefrontPage() {
  function addToCart(productId: string) {
    const cart = readCartFromStorage();
    const existing = cart.find((item) => item.productId === productId);
    const nextCart = existing
      ? cart.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
        )
      : [...cart, { productId, quantity: 1 }];

    writeCartToStorage(nextCart);
  }

  function resetCart() {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(defaultCart));
  }

  return (
    <div className="space-y-10">
      <section className="rounded-3xl bg-slate-950 px-8 py-12 text-white shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">Demo store</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-bold tracking-tight">
          A realistic checkout flow with a few intentionally seeded bugs.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-300">
          QuickCart is deliberately small, but it behaves like a real shopping flow: browse,
          add items, edit your cart, apply discounts, and place an order.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-200"
            href="/cart"
          >
            View cart
          </Link>
          <button
            className="rounded-full border border-white/30 px-5 py-3 font-semibold text-white hover:bg-white/10"
            onClick={resetCart}
            type="button"
          >
            Reset demo cart
          </button>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {products.map((product) => (
          <article
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            key={product.id}
          >
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-700">
              {product.badge}
            </span>
            <h2 className="mt-5 text-2xl font-bold text-slate-950">{product.name}</h2>
            <p className="mt-3 min-h-16 text-slate-600">{product.description}</p>
            <div className="mt-6 flex items-center justify-between">
              <span className="text-xl font-bold text-slate-950">{formatMoney(product.price)}</span>
              <button
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                onClick={() => addToCart(product.id)}
                type="button"
              >
                Add to cart
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

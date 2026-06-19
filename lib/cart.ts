import { products } from "@/lib/products";

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CartLine = CartItem & {
  name: string;
  price: number;
};

export const CART_STORAGE_KEY = "quickcart.items";

export const defaultCart: CartItem[] = [
  { productId: "espresso-maker", quantity: 1 },
  { productId: "desk-lamp", quantity: 1 },
];

export function hydrateCart(items: CartItem[]): CartLine[] {
  return items
    .map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);

      if (!product) {
        return null;
      }

      return {
        ...item,
        name: product.name,
        price: product.price,
      };
    })
    .filter((item): item is CartLine => item !== null);
}

export function readCartFromStorage(): CartItem[] {
  if (typeof window === "undefined") {
    return defaultCart;
  }

  const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);

  if (!rawCart) {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(defaultCart));
    return defaultCart;
  }

  try {
    return JSON.parse(rawCart) as CartItem[];
  } catch {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(defaultCart));
    return defaultCart;
  }
}

export function writeCartToStorage(items: CartItem[]) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

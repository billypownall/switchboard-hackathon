export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  badge: string;
};

export const products: Product[] = [
  {
    id: "espresso-maker",
    name: "BrewPro Espresso",
    description: "Compact espresso machine for apartment kitchens.",
    price: 189,
    badge: "Best seller",
  },
  {
    id: "desk-lamp",
    name: "Halo Desk Lamp",
    description: "Warm, dimmable task light with wireless charging.",
    price: 74,
    badge: "New",
  },
  {
    id: "weekender-bag",
    name: "Canvas Weekender",
    description: "Durable carry-on bag with a separate shoe pocket.",
    price: 126,
    badge: "Travel",
  },
];

export function formatMoney(value: number) {
  if (Number.isNaN(value)) {
    return "NaN";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

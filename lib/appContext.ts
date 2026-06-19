export const QUICKCART_BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const QUICKCART_APP_CONTEXT = `
QuickCart is a local demo e-commerce app used to test automated issue triage and reproduction.

Routes:
- /: Storefront with a product grid and Add to cart actions.
- /cart: Cart review page with quantity editing, item removal, and a Checkout link.
- /checkout: Checkout flow with line items, quantity fields, a SAVE10 coupon field, and a Place order button.
- /checkout?fast=1: Checkout with deterministic fast-mode timing for the duplicate-order race demo.
- /dashboard: Internal report dashboard showing submitted feedback and triage results.

Known intentional demo bug surfaces:
1. Applying coupon SAVE10 and then changing an item quantity can make the total display NaN.
2. Applying SAVE10, removing an item, then applying SAVE10 again can crash the coupon flow and disable Place order.
3. Double-clicking Place order quickly on /checkout?fast=1 can create duplicate order IDs.

Known feature-request examples:
- Asking for dark mode.
- Asking to save a payment method, use PayPal, or add another payment option.
`.trim();

// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * Bundle discount function.
 *
 * Config stored in the metafield (JSON):
 *   {
 *     title: "firts bundle",
 *     bundleItems: [{ variantId: "gid://shopify/ProductVariant/123", quantity: 2 }, ...],
 *     discountType: "fixed_amount" | "percentage",
 *     discountValue: 15,
 *     compareAtPrices: { "gid://shopify/ProductVariant/123": "600.00", ... }
 *   }
 *
 * The discount fires ONLY when EVERY bundleItem's variantId is present in the
 * cart with at least the required quantity.
 *
 * The merchant defines the bundle sale price as MRP total minus the discount
 * (e.g. MRP 600, discount 155 → sale 445). Because cart line items are priced
 * at their actual selling price, we only discount the DIFFERENCE between the
 * actual cart total and the target bundle price. This keeps checkout in sync
 * with the storefront bundle card instead of stacking the discount on top of
 * an already-discounted product price.
 *
 * The MRP per variant is resolved in this order:
 *   1. compareAtPrices[variantId] from the config (fetched at sync time)
 *   2. cost.compareAtAmountPerQuantity from the checkout input
 *   3. cost.amountPerQuantity (last resort — treated as MRP unknown if it
 *      is the only value, since the product price may differ from the MRP)
 *
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  let config;
  try {
    config = JSON.parse(input?.discountNode?.metafield?.value ?? "{}");
  } catch (_) {
    return EMPTY_DISCOUNT;
  }

  const bundleItems = Array.isArray(config.bundleItems) ? config.bundleItems : [];
  const discountType = config.discountType ?? "percentage";
  const discountValue = Number(config.discountValue) || 0;
  const compareAtPrices = config.compareAtPrices || {};

  if (!bundleItems.length || discountValue <= 0) return EMPTY_DISCOUNT;

  // Index cart lines by variant id with the actual unit price and compare-at
  // (MRP) unit price.
  const byVariant = {};
  const lines = input?.cart?.lines ?? [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const merch = line.merchandise;
    if (!merch || merch.__typename !== "ProductVariant") continue;
    const existing = byVariant[merch.id] || {
      qty: 0,
      price: Number(line.cost?.amountPerQuantity?.amount) || 0,
      compareAt: Number(line.cost?.compareAtAmountPerQuantity?.amount) || 0,
    };
    existing.qty += line.quantity;
    byVariant[merch.id] = existing;
  }

  // Check that EVERY bundle item is in the cart with at least the required
  // quantity, and sum the actual and MRP totals over the required quantities.
  let mrpTotal = 0;
  let actualTotal = 0;
  let mrpKnown = true;
  for (const item of bundleItems) {
    const required = Math.max(1, Number(item.quantity) || 1);
    const unit = byVariant[item.variantId];
    if (!unit || unit.qty < required) {
      // Missing required bundle item or insufficient quantity -> NO DISCOUNT
      return EMPTY_DISCOUNT;
    }
    const price = unit.price || 0;

    // Resolve MRP: config (sync-time) > cart compareAt > cart price.
    const configCompareAt = Number(compareAtPrices[item.variantId]) || 0;
    const cartCompareAt = Number(unit.compareAt) || 0;
    const compareAt = configCompareAt || cartCompareAt || price;

    // MRP is only considered known when we have an explicit compare-at from
    // the config or the cart.  Falling back to the cart price means the
    // product price IS the MRP, so there is no "gap" to discount.
    if (configCompareAt <= 0 && cartCompareAt <= 0) mrpKnown = false;

    actualTotal += price * required;
    mrpTotal += compareAt * required;
  }

  // Without the MRP for every bundle item we cannot compute the target price,
  // so apply no discount and let the products' own prices stand.
  if (!mrpKnown) return EMPTY_DISCOUNT;

  const discount =
    discountType === "fixed_amount"
      ? discountValue
      : (mrpTotal * discountValue) / 100;
  const targetTotal = Math.max(0, mrpTotal - discount);
  const discountToApply = Math.max(0, actualTotal - targetTotal);

  // The products are already priced at or below the target bundle price.
  if (discountToApply <= 0 || actualTotal <= 0) return EMPTY_DISCOUNT;

  const percentage = Math.min(100, (discountToApply / actualTotal) * 100);

  // Target all product variants in the bundle, limited to the required units.
  const targets = bundleItems.map((item) => ({
    productVariant: {
      id: item.variantId,
      quantity: Math.max(1, Number(item.quantity) || 1),
    },
  }));

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [
      {
        targets,
        value: { percentage: { value: percentage } },
        message: config.title ?? "Bundle discount",
      },
    ],
  };
}
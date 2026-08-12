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
 *     discountValue: 15
 *   }
 *
 * The discount fires ONLY when EVERY bundleItem's variantId is present in the
 * cart with at least the required quantity.
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

  if (!bundleItems.length || discountValue <= 0) return EMPTY_DISCOUNT;

  // Build map of variantId -> quantity in cart
  const cartQty = {};
  const lines = input?.cart?.lines ?? [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const merch = line.merchandise;
    if (!merch || merch.__typename !== "ProductVariant") continue;
    const vid = merch.id;
    cartQty[vid] = (cartQty[vid] || 0) + line.quantity;
  }

  // Check that EVERY bundle item is in the cart with at least the required quantity
  for (const item of bundleItems) {
    const required = Math.max(1, Number(item.quantity) || 1);
    const inCart = cartQty[item.variantId] || 0;
    if (inCart < required) {
      // Missing required bundle item or insufficient quantity -> NO DISCOUNT
      return EMPTY_DISCOUNT;
    }
  }

  // Target all product variants in the bundle
  const targets = bundleItems.map((item) => ({
    productVariant: {
      id: item.variantId,
    },
  }));

  const value =
    discountType === "fixed_amount"
      ? { fixedAmount: { amount: discountValue.toFixed(2) } }
      : { percentage: { value: discountValue } };

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.First,
    discounts: [
      {
        targets,
        value,
        message: config.title ?? "Bundle discount",
      },
    ],
  };
}

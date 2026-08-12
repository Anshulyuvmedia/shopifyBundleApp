/**
 * Builds the input for DiscountAutomaticAppCreate (Function-based bundle discount).
 *
 * The bundle config is stored in a metafield so the Shopify Function can read
 * it at checkout time and enforce that ALL bundle items are in the cart.
 *
 * @param {object} bundle - The bundle record from the database
 * @param {string} functionId - The Shopify Function ID (from the deployed extension)
 */
export function buildBundleAppInput(bundle, functionId) {
  const items = Array.isArray(bundle.items) ? bundle.items : [];

  const bundleItems = items.map((item) => ({
    variantId: String(item.id),
    quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
  }));

  const configValue = JSON.stringify({
    title: bundle.title,
    bundleItems,
    discountType: bundle.discountType,
    discountValue: Number(bundle.discountValue) || 0,
  });

  return {
    title: bundle.title,
    startsAt: new Date().toISOString(),
    endsAt: bundle.endsAt ? new Date(bundle.endsAt).toISOString() : null,
    functionId,
    metafields: [
      {
        namespace: "$app:quantity-break-discount",
        key: "function-configuration",
        type: "json",
        value: configValue,
      },
    ],
  };
}

export function buildAppliesOn(products) {
  const ids = (products ?? []).map((product) => product.id).filter(Boolean);
  if (ids.length === 0) return { all: true };
  return {
    products: {
      productsToAdd: ids,
      productsToRemove: [],
      productVariantsToAdd: [],
      productVariantsToRemove: [],
    },
  };
}

export function buildBundleAppliesOn(items) {
  const ids = (items ?? [])
    .map((item) => item.id)
    .filter(Boolean);
  if (ids.length === 0) return { all: true };
  return {
    products: {
      productsToAdd: [],
      productsToRemove: [],
      productVariantsToAdd: ids,
      productVariantsToRemove: [],
    },
  };
}

/**
 * Builds a DiscountAutomaticBxgyInput for a bundle.
 *
 * The customer must purchase all bundle variants (totalling `totalQuantity`
 * units) before the discount fires — i.e. a true "buy the whole bundle,
 * save X" offer rather than a per-variant automatic discount.
 */
export function buildBundleInput(bundle) {
  const items = Array.isArray(bundle.items) ? bundle.items : [];
  const totalQuantity = Math.max(
    1,
    items.reduce((sum, item) => sum + (Math.max(1, Math.floor(Number(item.quantity) || 1))), 0),
  );
  const appliesOn = buildBundleAppliesOn(items);

  const discountEffect =
    bundle.discountType === "fixed_amount"
      ? {
          discountAmount: {
            amount: (Number(bundle.discountValue) || 0).toFixed(2),
            appliesOnEachItem: false,
          },
        }
      : { percentage: Number(bundle.discountValue) || 0 };

  return {
    title: bundle.title,
    startsAt: new Date().toISOString(),
    endsAt: bundle.endsAt ? new Date(bundle.endsAt).toISOString() : null,
    customerBuys: {
      items: appliesOn,
      value: { quantity: totalQuantity },
    },
    customerGets: {
      items: appliesOn,
      value: {
        discountOnQuantity: {
          quantity: totalQuantity,
          effect: discountEffect,
        },
      },
    },
  };
}

export function buildMinimumRequirement(details) {
  const minSpend = Number(details?.minSpend) || 0;
  if (minSpend <= 0) return null;
  return {
    subtotal: { greaterThanOrEqualToSubtotal: minSpend.toFixed(2) },
  };
}

export function buildOrderValue(discount) {
  const details = discount.details ?? {};
  if (discount.type === "fixed_amount") {
    return {
      discountAmount: {
        amount: (Number(details.amount) || 0).toFixed(2),
        appliesOnEachItem: false,
      },
    };
  }
  if (details.discountType === "fixed_amount") {
    return {
      discountAmount: {
        amount: (Number(details.discountValue) || 0).toFixed(2),
        appliesOnEachItem: false,
      },
    };
  }
  return { percentage: Number(details.discountValue) || 0 };
}

export function buildInput(discount) {
  const details = discount.details ?? {};
  const base = {
    title: discount.title,
    startsAt: new Date().toISOString(),
    endsAt: discount.endsAt ? new Date(discount.endsAt).toISOString() : null,
    tags: [discount.title],
  };
  const appliesOn = buildAppliesOn(discount.products);
  const minimumRequirement = buildMinimumRequirement(details);

  if (discount.type === "buy_x_get_y") {
    const buyQuantity = Math.max(1, Math.floor(Number(details.buyQuantity) || 1));
    const getQuantity = Math.max(1, Math.floor(Number(details.getQuantity) || 1));
    const percentage = Math.min(100, Number(details.discountValue) || 0);
    return {
      ...base,
      customerBuys: { items: appliesOn, value: { quantity: buyQuantity } },
      customerGets: {
        items: appliesOn,
        value: {
          discountOnQuantity: {
            quantity: getQuantity,
            effect: { percentage },
          },
        },
      },
    };
  }

  if (discount.type === "free_shipping") {
    return {
      ...base,
      destination: { all: true },
      appliesOnOneTimePurchase: true,
      appliesOnSubscription: true,
      ...(minimumRequirement ? { minimumRequirement } : {}),
    };
  }

  return {
    ...base,
    customerGets: {
      items: appliesOn,
      value: buildOrderValue(discount),
    },
    ...(minimumRequirement ? { minimumRequirement } : {}),
  };
}

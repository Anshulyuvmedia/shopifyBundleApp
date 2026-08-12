import { unauthenticated } from "./shopify.server";
import { buildBundleAppInput, buildInput } from "./discounts-mapping.server";

const BASIC_CREATE = `#graphql
  mutation DiscountAutomaticBasicCreate($input: DiscountAutomaticBasicInput!) {
    discountAutomaticBasicCreate(automaticBasicDiscount: $input) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const BXGY_CREATE = `#graphql
  mutation DiscountAutomaticBxgyCreate($input: DiscountAutomaticBxgyInput!) {
    discountAutomaticBxgyCreate(automaticBxgyDiscount: $input) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const FREE_SHIPPING_CREATE = `#graphql
  mutation DiscountAutomaticFreeShippingCreate($input: DiscountAutomaticFreeShippingInput!) {
    discountAutomaticFreeShippingCreate(freeShippingAutomaticDiscount: $input) {
      automaticDiscountNode {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const APP_CREATE = `#graphql
  mutation DiscountAutomaticAppCreate($input: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $input) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE = `#graphql
  mutation DiscountAutomaticDelete($id: ID!) {
    discountAutomaticDelete(id: $id) {
      deletedAutomaticDiscountId
      userErrors {
        field
        message
      }
    }
  }
`;

const MUTATION_NAME = {
  BASIC_CREATE: "discountAutomaticBasicCreate",
  BXGY_CREATE: "discountAutomaticBxgyCreate",
  FREE_SHIPPING_CREATE: "discountAutomaticFreeShippingCreate",
  APP_CREATE: "discountAutomaticAppCreate",
  DELETE: "discountAutomaticDelete",
};

function firstError(userErrors) {
  if (!Array.isArray(userErrors)) return null;
  const messages = userErrors.map((error) => error.message).filter(Boolean);
  return messages.length ? messages.join(". ") : null;
}

function mutationFor(discount) {
  if (discount.type === "buy_x_get_y") {
    return { query: BXGY_CREATE, name: MUTATION_NAME.BXGY_CREATE };
  }
  if (discount.type === "free_shipping") {
    return { query: FREE_SHIPPING_CREATE, name: MUTATION_NAME.FREE_SHIPPING_CREATE };
  }
  return { query: BASIC_CREATE, name: MUTATION_NAME.BASIC_CREATE };
}

export async function deleteShopifyDiscount(shop, shopifyDiscountId) {
  if (!shopifyDiscountId) return { ok: true, errors: null };
  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(DELETE, {
      variables: { id: shopifyDiscountId },
    });
    const body = await response.json();
    const errors = firstError(
      body.data?.[MUTATION_NAME.DELETE]?.userErrors ?? [],
    );
    // The discount was already deleted on Shopify (e.g. manually in the admin)
    // — treat a stale ID as a successful cleanup.
    if (errors && errors.toLowerCase().includes("does not exist")) {
      return { ok: true, errors: null };
    }
    return { ok: !errors, errors };
  } catch (error) {
    return { ok: false, errors: error.message };
  }
}

export async function syncDiscountToShopify(shop, discount) {
  if (discount.status !== "active") {
    const result = await deleteShopifyDiscount(shop, discount.shopifyDiscountId);
    return {
      ok: result.ok,
      shopifyDiscountId: null,
      errors: result.errors,
    };
  }

  try {
    if (discount.shopifyDiscountId) {
      const removed = await deleteShopifyDiscount(shop, discount.shopifyDiscountId);
      if (!removed.ok) {
        return { ok: false, shopifyDiscountId: null, errors: removed.errors };
      }
    }

    const { admin } = await unauthenticated.admin(shop);
    const { query, name } = mutationFor(discount);
    const response = await admin.graphql(query, {
      variables: { input: buildInput(discount) },
    });
    const body = await response.json();

    const errors = firstError(body.data?.[name]?.userErrors ?? []);
    if (errors) {
      return { ok: false, shopifyDiscountId: null, errors };
    }

    const id = body.data?.[name]?.automaticDiscountNode?.id ?? null;
    if (!id) {
      return { ok: false, shopifyDiscountId: null, errors: "Could not create Shopify discount." };
    }
    return { ok: true, shopifyDiscountId: id, errors: null };
  } catch (error) {
    return { ok: false, shopifyDiscountId: null, errors: error.message };
  }
}

/** Cache the Function GID per shop to avoid repeated API calls. */
const functionIdCache = new Map();

const GET_FUNCTIONS = `#graphql
  query GetFunctions {
    shopifyFunctions(first: 50) {
      nodes {
        id
        handle
      }
    }
  }
`;

async function getBundleFunctionId(admin) {
  const cacheKey = "bundle-function";
  if (functionIdCache.has(cacheKey)) return functionIdCache.get(cacheKey);

  // The `query` argument was removed from the shopifyFunctions field, so list
  // the functions and match the handle client-side.
  const response = await admin.graphql(GET_FUNCTIONS);
  const body = await response.json();
  const nodes = body.data?.shopifyFunctions?.nodes ?? [];
  const fn = nodes.find((n) => n.handle === "quantity-break-discount");
  if (!fn?.id) return null;

  functionIdCache.set(cacheKey, fn.id);
  return fn.id;
}

export async function syncBundleToShopify(shop, bundle) {
  const shouldCreate =
    bundle.status === "active" &&
    bundle.discountType !== "none" &&
    Number(bundle.discountValue) > 0;

  if (!shouldCreate) {
    const result = await deleteShopifyDiscount(shop, bundle.shopifyDiscountId);
    return {
      ok: result.ok,
      shopifyDiscountId: null,
      errors: result.errors,
    };
  }

  try {
    const { admin } = await unauthenticated.admin(shop);

    // Fetch the deployed Shopify Function GID FIRST. If this fails there is
    // nothing to sync, and deleting the existing discount below would leave
    // the store with no discount at all.
    const functionId = await getBundleFunctionId(admin);
    if (!functionId) {
      return {
        ok: false,
        shopifyDiscountId: null,
        errors:
          "Could not find the quantity-break-discount Shopify Function. " +
          "Make sure the extension is deployed (run `shopify app dev`).",
      };
    }

    if (bundle.shopifyDiscountId) {
      const removed = await deleteShopifyDiscount(shop, bundle.shopifyDiscountId);
      if (!removed.ok) {
        return { ok: false, shopifyDiscountId: null, errors: removed.errors };
      }
    }

    const response = await admin.graphql(APP_CREATE, {
      variables: { input: buildBundleAppInput(bundle, functionId) },
    });
    const body = await response.json();

    const errors = firstError(
      body.data?.[MUTATION_NAME.APP_CREATE]?.userErrors ?? [],
    );
    if (errors) {
      return { ok: false, shopifyDiscountId: null, errors };
    }

    // App discounts return discountId (a GID), not automaticDiscountNode
    const id =
      body.data?.[MUTATION_NAME.APP_CREATE]?.automaticAppDiscount?.discountId ?? null;
    if (!id) {
      return { ok: false, shopifyDiscountId: null, errors: "Could not create app discount." };
    }
    return { ok: true, shopifyDiscountId: id, errors: null };
  } catch (error) {
    return { ok: false, shopifyDiscountId: null, errors: error.message };
  }
}


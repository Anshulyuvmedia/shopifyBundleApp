import { authenticate, apiVersion } from "../shopify.server";
import prisma from "../db.server";

/**
 * The storefront blocks pass numeric Liquid IDs (e.g. `{{ product.id }}`,
 * `cart.items[].variant_id`), while bundles/quantity breaks store full GIDs
 * (`gid://shopify/Product/...`). Normalize incoming IDs to GIDs so they match.
 */
function toGid(id, type) {
  const value = String(id ?? "").trim();
  if (!value) return "";
  if (value.startsWith("gid://")) return value;
  return `gid://shopify/${type}/${value}`;
}

/** Extract the numeric suffix from a GID (used by the /cart/add.js AJAX API). */
function numericId(gid) {
  return String(gid ?? "").split("/").pop() || "";
}

/**
 * Fetch variant prices for the bundle items via the Admin REST API so the
 * storefront can display bundle totals and savings.
 */
async function fetchVariantPrices(session, numericIds) {
  const ids = [...new Set(numericIds.filter(Boolean))];
  if (!ids.length) return {};
  try {
    const res = await fetch(
      `https://${session.shop}/admin/api/${apiVersion}/variants.json?ids=${ids.join(",")}&fields=id,price,compare_at_price`,
      { headers: { "X-Shopify-Access-Token": session.accessToken } },
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const v of data.variants ?? []) {
      map[String(v.id)] = {
        price: Number(v.price) || 0,
        compareAtPrice: Number(v.compare_at_price) || 0,
      };
    }
    return map;
  } catch (error) {
    return {};
  }
}

/**
 * Fetch the primary product image for items stored without an imageUrl
 * (e.g. bundles created before images were captured) so the storefront
 * bundle cards can always show a thumbnail.
 */
async function fetchProductImages(session, numericProductIds) {
  const ids = [...new Set(numericProductIds.filter(Boolean))];
  if (!ids.length) return {};
  try {
    const res = await fetch(
      `https://${session.shop}/admin/api/${apiVersion}/products.json?ids=${ids.join(",")}&fields=id,image&limit=250`,
      { headers: { "X-Shopify-Access-Token": session.accessToken } },
    );
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const p of data.products ?? []) {
      const src = p.image?.src ?? "";
      if (src) map[String(p.id)] = src;
    }
    return map;
  } catch (error) {
    return {};
  }
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return Response.json({ error: "No session found for this shop." }, { status: 404 });
  }

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true";
  const productId = toGid(url.searchParams.get("product_id"), "Product");
  const productIds = (url.searchParams.get("product_ids") ?? "")
    .split(",")
    .map((id) => toGid(id, "Product"))
    .filter(Boolean);
  const variantIds = (url.searchParams.get("variant_ids") ?? "")
    .split(",")
    .map((id) => toGid(id, "ProductVariant"))
    .filter(Boolean);
  const allProductIds = productId
    ? [productId, ...productIds.filter((id) => id !== productId)]
    : productIds;

  const quantityBreaks = [];
  const bundles = [];

  if (all || productId || variantIds.length > 0 || allProductIds.length > 0) {
    const [qbRows, bundleRows] = await Promise.all([
      prisma.quantityBreak.findMany({
        where: { shop: session.shop, status: "active" },
        include: { tiers: { orderBy: { minQuantity: "asc" } } },
      }),
      prisma.bundle.findMany({
        where: { shop: session.shop, status: "active" },
      }),
    ]);

    const mapQuantityBreak = (row) => ({
      id: row.id,
      title: row.title,
      tiers: row.tiers.map((t) => ({
        minQuantity: t.minQuantity,
        discountType: t.discountType,
        discountValue: t.discountValue,
      })),
    });

    const mapBundle = (row, matchedVariantIds) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      discountType: row.discountType,
      discountValue: row.discountValue,
      items: (Array.isArray(row.items) ? row.items : []).map((item) => ({
        variantId: String(item.id),
        cartId: numericId(item.id),
        productId: String(item.productId ?? item.id ?? ""),
        title: String(
          item.title ?? item.variantTitle ?? item.productTitle ?? "Product",
        )
          .replace(/\s*-\s*Default Title$/i, "")
          .trim() || "Product",
        imageUrl: item.imageUrl ?? "",
        quantity: Number(item.quantity) || 1,
      })),
      matchedVariantIds,
    });

    if (all) {
      for (const row of qbRows) quantityBreaks.push(mapQuantityBreak(row));
      for (const row of bundleRows) bundles.push(mapBundle(row, []));
    } else {
      for (const row of qbRows) {
        const products = Array.isArray(row.products) ? row.products : [];
        if (
          allProductIds.some((pid) =>
            products.some((p) => String(p.id) === String(pid)),
          )
        ) {
          quantityBreaks.push(mapQuantityBreak(row));
        }
      }

      for (const row of bundleRows) {
        const items = Array.isArray(row.items) ? row.items : [];
        const matches = items.filter((item) =>
          variantIds.some((vid) => String(vid) === String(item.id)),
        );
        if (matches.length > 0) {
          bundles.push(
            mapBundle(row, matches.map((item) => String(item.id))),
          );
        }
      }
    }
  }

  const variantIdsSet = new Set(
    bundles.flatMap((bundle) =>
      (Array.isArray(bundle.items) ? bundle.items : []).map((item) => item.cartId),
    ),
  );
  const productIdsMissingImage = new Set(
    bundles.flatMap((bundle) =>
      (Array.isArray(bundle.items) ? bundle.items : [])
        .filter((item) => !item.imageUrl && item.productId)
        .map((item) => numericId(item.productId)),
    ),
  );
  const [prices, productImages] = await Promise.all([
    fetchVariantPrices(session, [...variantIdsSet]),
    fetchProductImages(session, [...productIdsMissingImage]),
  ]);
  for (const bundle of bundles) {
    bundle.items = (bundle.items ?? []).map((item) => ({
      ...item,
      imageUrl:
        item.imageUrl ||
        (item.productId ? productImages[numericId(item.productId)] ?? "" : ""),
      price: prices[item.cartId]?.price ?? null,
      compareAtPrice: prices[item.cartId]?.compareAtPrice ?? null,
    }));
  }

  return Response.json({ productId, quantityBreaks, bundles });
};

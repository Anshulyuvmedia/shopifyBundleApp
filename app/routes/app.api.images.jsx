import { authenticate, apiVersion } from "../shopify.server";

function numericIds(list) {
  return [...new Set((list ?? []).map(String).filter(Boolean))]
    .map((id) => id.split("/").pop())
    .filter(Boolean);
}

/**
 * Resolve the primary product image for a set of bundle items (variants and/or
 * products). Keeps item thumbnails visible in the admin bundle form even when
 * the App Bridge resource picker did not return an inline image.
 */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const variantIds = numericIds(url.searchParams.get("variant_ids")?.split(","));
  const productIds = numericIds(url.searchParams.get("product_ids")?.split(","));

  try {
    const map = {};

    if (variantIds.length) {
      const res = await fetch(
        `https://${session.shop}/admin/api/${apiVersion}/variants.json?ids=${variantIds.join(",")}&fields=id,product_id`,
        { headers: { "X-Shopify-Access-Token": session.accessToken } },
      );
      if (res.ok) {
        const data = await res.json();
        for (const v of data.variants ?? []) {
          if (v.product_id) productIds.push(String(v.product_id));
        }
      }
    }

    if (productIds.length) {
      const res = await fetch(
        `https://${session.shop}/admin/api/${apiVersion}/products.json?ids=${productIds.join(",")}&fields=id,image&limit=250`,
        { headers: { "X-Shopify-Access-Token": session.accessToken } },
      );
      if (res.ok) {
        const data = await res.json();
        for (const p of data.products ?? []) {
          const src = p.image?.src ?? "";
          if (src) {
            map[String(p.id)] = src;
            map[`gid://shopify/Product/${p.id}`] = src;
          }
        }
      }
    }

    return Response.json({ images: map });
  } catch (error) {
    return Response.json({ images: {} });
  }
};
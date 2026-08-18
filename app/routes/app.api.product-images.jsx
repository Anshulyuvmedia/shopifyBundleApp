import { authenticate, apiVersion } from "../shopify.server";

function numericIds(list) {
  return [...new Set((list ?? []).map(String).filter(Boolean))]
    .map((id) => id.split("/").pop())
    .filter(Boolean);
}

/**
 * Resolve ALL images for a product so the bundle card image picker can offer
 * every existing image instead of requiring a manually pasted URL.
 */
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productIds = numericIds(url.searchParams.get("product_ids")?.split(","));

  try {
    const map = {};
    if (productIds.length) {
      const res = await fetch(
        `https://${session.shop}/admin/api/${apiVersion}/products.json?ids=${productIds.join(",")}&fields=id,images&limit=250`,
        { headers: { "X-Shopify-Access-Token": session.accessToken } },
      );
      if (res.ok) {
        const data = await res.json();
        for (const p of data.products ?? []) {
          const images = (p.images ?? [])
            .map((img) => ({
              id: String(img.id ?? ""),
              src: img.src ?? "",
              alt: img.alt ?? "",
            }))
            .filter((img) => img.src);
          map[String(p.id)] = images;
          map[`gid://shopify/Product/${p.id}`] = images;
        }
      }
    }
    return Response.json({ images: map });
  } catch (error) {
    return Response.json({ images: {} });
  }
};
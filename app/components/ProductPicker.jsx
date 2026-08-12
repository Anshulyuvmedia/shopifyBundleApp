import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

function cleanName(name) {
  return String(name || "")
    .replace(/\s*[-–—]\s*Default Title$/i, "")
    .trim();
}

function itemDisplayName(item) {
  const productTitle = cleanName(item.productTitle) || item.title || "Untitled product";
  const variantTitle = String(item.variantTitle || "").trim();
  if (!variantTitle || variantTitle === "Default Title") return productTitle;
  const cleanedVariant = cleanName(variantTitle);
  if (!cleanedVariant || productTitle.toLowerCase().includes(cleanedVariant.toLowerCase()))
    return productTitle;
  return `${productTitle} — ${variantTitle}`;
}

function normalizeProduct(resource) {
  return {
    id: resource.id,
    title: resource.title ?? "Untitled product",
    imageUrl: resource.images?.[0]?.originalSrc ?? "",
  };
}

/**
 * The variant-type resource picker renders products without images/names on
 * desktop (known App Bridge issue). Use the product picker with
 * `filter: { variants: true }` instead: it shows product thumbnails and
 * returns each product with the selected `variants` array.
 */
function normalizePickedVariants(resources) {
  const items = [];
  for (const product of resources) {
    const productId = product.id ?? "";
    const productTitle = product.title ?? "Untitled product";
    const productImage =
      product.images?.[0]?.originalSrc ??
      product.image?.originalSrc ??
      "";
    const variants = Array.isArray(product.variants) ? product.variants : [];
    for (const variant of variants) {
      items.push({
        id: variant.id,
        productId,
        productTitle,
        variantTitle: variant.title ?? "Default Title",
        imageUrl: variant.image?.originalSrc ?? productImage,
        quantity: 1,
      });
    }
  }
  return items;
}

function selectionIdsForVariants(selection) {
  const byProduct = {};
  for (const item of selection) {
    const productId = item.productId || item.id;
    if (!productId) continue;
    if (!byProduct[productId]) byProduct[productId] = [];
    byProduct[productId].push({ id: item.id });
  }
  return Object.entries(byProduct).map(([id, variants]) => ({ id, variants }));
}

export default function ProductPicker({
  resourceType = "product",
  selection,
  onSelectionChange,
  showQuantity = false,
}) {
  const shopify = useAppBridge();
  const isVariant = resourceType === "variant";

  useEffect(() => {
    const missing = selection.filter((item) => !item.imageUrl);
    if (!missing.length) return;

    const numericId = (id) => String(id ?? "").split("/").pop();

    const variantIds = missing
      .filter((item) => item.id && isVariant)
      .map((item) => numericId(item.id))
      .filter(Boolean);
    const productIds = missing.map((item) => numericId(item.productId)).filter(Boolean);

    if (!variantIds.length && !productIds.length) return;

    const params = new URLSearchParams();
    if (variantIds.length) params.set("variant_ids", variantIds.join(","));
    if (productIds.length) params.set("product_ids", productIds.join(","));

    let cancelled = false;
    fetch(`/app/api/images?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { images: {} }))
      .then((data) => {
        if (cancelled) return;
        const images = data.images ?? {};
        const updated = selection.map((item) => {
          if (item.imageUrl) return item;
          const key =
            images[numericId(item.productId)] ??
            images[`gid://shopify/Product/${numericId(item.productId)}`] ??
            images[numericId(item.id)] ??
            images[`gid://shopify/ProductVariant/${numericId(item.id)}`] ??
            "";
          return key ? { ...item, imageUrl: key } : item;
        });
        if (updated.some((item, i) => item.imageUrl !== selection[i].imageUrl)) {
          onSelectionChange(updated);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selection, isVariant, onSelectionChange]);

  const openPicker = async () => {
    const config = isVariant
      ? {
          type: "product",
          multiple: true,
          action: "select",
          filter: { variants: true },
          selectionIds: selectionIdsForVariants(selection),
        }
      : {
          type: "product",
          multiple: true,
          action: "select",
          selectionIds: selection.map((item) => ({ id: item.id })),
        };

    const resources = await shopify.resourcePicker(config);
    if (!resources) return;

    const normalized = isVariant
      ? normalizePickedVariants(resources)
      : resources.map(normalizeProduct);
    onSelectionChange(normalized);
  };

  const removeItem = (id) => {
    onSelectionChange(selection.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, quantity) => {
    onSelectionChange(
      selection.map((item) =>
        item.id === id ? { ...item, quantity } : item,
      ),
    );
  };

  return (
    <s-stack direction="block" gap="base">
      {selection.map((item) => (
        <s-box
          key={item.id}
          padding="small"
          borderWidth="base"
          borderColor="subdued"
          borderRadius="base"
        >
          <s-stack direction="inline" gap="base" blockAlign="center">
            <s-thumbnail
              src={item.imageUrl ?? ""}
              alt={item.productTitle ?? item.title ?? "Product"}
              size="base"
            />
            <s-paragraph>
              {isVariant ? itemDisplayName(item) : item.title}
            </s-paragraph>
            {showQuantity && (
              <s-number-field
                label="Qty"
                value={String(item.quantity ?? 1)}
                min="1"
                onInput={(event) =>
                  updateQuantity(item.id, event.target.value)
                }
              />
            )}
            <s-button
              onClick={() => removeItem(item.id)}
              variant="tertiary"
              tone="critical"
            >
              Remove
            </s-button>
          </s-stack>
        </s-box>
      ))}
      <s-button onClick={openPicker}>
        {selection.length > 0
          ? "Edit selection"
          : "Select products"}
      </s-button>
    </s-stack>
  );
}
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

function stripVariantFromName(displayName, variantTitle) {
  const name = String(displayName || "");
  const variant = variantTitle ? String(variantTitle).trim() : "";
  if (!variant) return name;
  const idx = name.lastIndexOf(variant);
  if (idx <= 0) return name;
  const prefix = name.slice(0, idx).replace(/\s*[-–—]\s*$/, "").trim();
  return prefix || name;
}

function normalizeProduct(resource) {
  return {
    id: resource.id,
    title: resource.title ?? "Untitled product",
    imageUrl: resource.images?.[0]?.originalSrc ?? "",
  };
}

function normalizeVariant(resource) {
  const product = resource.product ?? {};
  const productImages = product.images ?? [];
  const hasProductTitle = Boolean(product.title);
  const variantTitle =
    resource.title ??
    (resource.displayName ? resource.displayName.split(" - ").pop() : "") ??
    "";
  const productTitle = hasProductTitle
    ? product.title
    : variantTitle
      ? stripVariantFromName(resource.displayName, variantTitle)
      : (resource.displayName ?? resource.title ?? "Untitled product");
  return {
    id: resource.id,
    productId: product.id ?? "",
    productTitle,
    variantTitle,
    imageUrl: resource.image?.originalSrc ?? productImages[0]?.originalSrc ?? "",
    quantity: 1,
  };
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
    const resources = await shopify.resourcePicker({
      type: resourceType,
      multiple: true,
      action: "select",
      selectionIds: selection.map((item) => ({ id: item.id })),
    });
    if (!resources) return;

    const normalized = isVariant
      ? resources.map(normalizeVariant)
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
              {isVariant
                ? `${item.productTitle}${
                    item.variantTitle && item.variantTitle !== "Default Title"
                      ? ` — ${item.variantTitle}`
                      : ""
                  }`
                : item.title}
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
          : isVariant
            ? "Select products"
            : "Select products"}
      </s-button>
    </s-stack>
  );
}
import { useAppBridge } from "@shopify/app-bridge-react";

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
  return {
    id: resource.id,
    productId: product.id ?? "",
    productTitle: product.title ?? resource.displayName ?? resource.title ?? "Untitled product",
    variantTitle: resource.displayName ?? resource.title ?? "",
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
                    item.variantTitle ? ` — ${item.variantTitle}` : ""
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

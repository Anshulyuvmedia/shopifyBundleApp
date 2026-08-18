import { useAppBridge } from "@shopify/app-bridge-react";

function imageSrc(product) {
  return (
    product.images?.[0]?.originalSrc ??
    product.image?.originalSrc ??
    ""
  );
}

export default function BundleDisplayPicker({ value, onChange }) {
  const shopify = useAppBridge();

  const pickProduct = async () => {
    const resources = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    const product = resources?.[0];
    if (!product) return;
    onChange({
      id: product.id,
      title: product.title ?? "Untitled product",
      imageUrl: imageSrc(product),
    });
  };

  const showOnAll = () => onChange(null);

  return (
    <s-stack direction="block" gap="base">
      {value ? (
        <s-stack direction="inline" gap="base" blockAlign="center">
          <s-thumbnail src={value.imageUrl ?? ""} alt={value.title} size="base" />
          <s-paragraph>{value.title}</s-paragraph>
          <s-button variant="tertiary" tone="critical" onClick={showOnAll}>
            Show on all products
          </s-button>
        </s-stack>
      ) : (
        <s-paragraph color="subdued">
          Currently shows on every product included in the bundle.
        </s-paragraph>
      )}
      <s-button onClick={pickProduct}>
        {value ? "Change product" : "Restrict to a specific product"}
      </s-button>
    </s-stack>
  );
}
import { useState } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

function numericId(id) {
  return String(id ?? "").split("/").pop();
}

export default function BundleImagePicker({ value, onChange }) {
  const shopify = useAppBridge();
  const [images, setImages] = useState([]);
  const [productName, setProductName] = useState("");
  const [loading, setLoading] = useState(false);

  const loadImages = async (productId) => {
    const params = new URLSearchParams();
    params.set("product_ids", numericId(productId));
    setLoading(true);
    try {
      const res = await fetch(`/app/api/product-images?${params.toString()}`);
      if (!res.ok) return [];
      const data = await res.json();
      const map = data.images ?? {};
      return map[productId] ?? map[numericId(productId)] ?? [];
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  };

  const pickProduct = async () => {
    const resources = await shopify.resourcePicker({
      type: "product",
      multiple: false,
      action: "select",
    });
    const product = resources?.[0];
    if (!product) return;

    setProductName(product.title ?? "Selected product");
    const fetched = await loadImages(product.id);
    setImages(fetched);
    if (!value && fetched.length > 0) {
      onChange(fetched[0].src);
    }
  };

  const removeImage = () => {
    onChange("");
    setImages([]);
    setProductName("");
  };

  const isSelected = (src) => src === value;

  return (
    <s-stack direction="block" gap="base">
      {value && (
        <s-stack direction="inline" gap="base" blockAlign="center">
          <img
            src={value}
            alt="Bundle card preview"
            style={{
              maxWidth: "200px",
              maxHeight: "120px",
              borderRadius: "8px",
              border: "1px solid #ddd",
            }}
          />
          <s-button variant="tertiary" tone="critical" onClick={removeImage}>
            Remove image
          </s-button>
        </s-stack>
      )}

      <s-button onClick={pickProduct} loading={loading}>
        {value ? "Change image" : "Pick product image"}
      </s-button>

      {productName && (
        <s-paragraph color="subdued">
          Showing images from <strong>{productName}</strong>. Select one to use
          it as the bundle card image.
        </s-paragraph>
      )}

      {productName && !loading && images.length === 0 && (
        <s-paragraph tone="critical">
          No images found for this product.
        </s-paragraph>
      )}

      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {images.map((image) => {
            const selected = isSelected(image.src);
            return (
              <button
                type="button"
                key={image.id || image.src}
                onClick={() => onChange(image.src)}
                aria-label={`Use image: ${image.alt || productName}`}
                title={image.alt || productName}
                style={{
                  padding: 0,
                  border: selected ? "2px solid #008060" : "2px solid #c9cccf",
                  borderRadius: "6px",
                  cursor: "pointer",
                  overflow: "hidden",
                  background: "none",
                  outlineOffset: "2px",
                }}
              >
                <img
                  src={image.src}
                  alt={image.alt || productName}
                  style={{
                    width: "64px",
                    height: "64px",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </s-stack>
  );
}
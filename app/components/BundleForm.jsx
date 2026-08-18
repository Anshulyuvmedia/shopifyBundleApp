import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import BundleDisplayPicker from "./BundleDisplayPicker";
import BundleImagePicker from "./BundleImagePicker";
import ProductPicker from "./ProductPicker";
import FormErrors from "./FormErrors";

const emptyForm = {
  title: "",
  label: "",
  description: "",
  freeShippingText: "",
  freeGiftText: "",
  cardImageUrl: "",
  status: "active",
  discountType: "percentage",
  discountValue: 15,
  position: 0,
  displayProductId: "",
  displayProductTitle: "",
  items: [],
};

export default function BundleForm({ initial }) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [form, setForm] = useState(initial ?? emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  useEffect(() => {
    if (fetcher.data?.ok) {
      const sync = fetcher.data.sync;
      shopify.toast.show(
        sync?.ok === false
          ? `Bundle saved, but Shopify sync failed: ${sync.errors ?? "unknown error"}`
          : "Bundle saved",
      );
      navigate("/app/bundles");
    } else if (fetcher.data?.errors) {
      setErrors(fetcher.data.errors);
    }
  }, [fetcher.data, navigate, shopify]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors({});
    fetcher.submit(JSON.stringify(form), {
      method: "POST",
      encType: "application/json",
    });
  };

  const loading = fetcher.state === "submitting";
  const discountOff =
    form.discountType === "none" || Number(form.discountValue) === 0;

  return (
    <form onSubmit={handleSubmit}>
      <s-stack direction="block" gap="base">
        <FormErrors errors={errors} />
        <s-section heading="Details">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Title"
              value={form.title}
              required
              error={errors.title}
              onInput={(event) => setField("title", event.target.value)}
            />
            <s-text-field
              label="Label"
              value={form.label}
              placeholder="e.g. Try Pack, Value Pack, Super Saver Pack"
              onInput={(event) => setField("label", event.target.value)}
            />
            <s-text-area
              label="Description"
              value={form.description}
              onInput={(event) => setField("description", event.target.value)}
            />
            <s-select
              label="Status"
              value={form.status}
              onInput={(event) => setField("status", event.target.value)}
            >
              <s-option value="active">Active</s-option>
              <s-option value="paused">Paused</s-option>
            </s-select>
          </s-stack>
        </s-section>

        <s-section heading="Card display">
          <s-stack direction="block" gap="base">
            <BundleImagePicker
              value={form.cardImageUrl}
              onChange={(url) => setField("cardImageUrl", url)}
            />
            <s-text-field
              label="Free Shipping Text"
              value={form.freeShippingText}
              placeholder="e.g. Free Shipping, Free Shipping + Surprise Gift"
              onInput={(event) => setField("freeShippingText", event.target.value)}
            />
            <s-text-field
              label="Free Gift Text"
              value={form.freeGiftText}
              placeholder="e.g. FREE Gift (shown below the bundle)"
              onInput={(event) => setField("freeGiftText", event.target.value)}
            />
          </s-stack>
        </s-section>

        <s-section heading="Bundle products">
          <s-paragraph color="subdued">
            Add the products that make up this bundle and how many of each is
            included.
          </s-paragraph>
          <ProductPicker
            resourceType="variant"
            selection={form.items}
            onSelectionChange={(items) => setField("items", items)}
            showQuantity
          />
          {errors.items && (
            <s-paragraph tone="critical">{errors.items}</s-paragraph>
          )}
        </s-section>

        <s-section heading="Where this offer shows">
          <s-paragraph color="subdued">
            By default the bundle appears on every product page included in the
            bundle. Choose a single product to show the offer on that product
            page only.
          </s-paragraph>
          <BundleDisplayPicker
            value={
              form.displayProductId
                ? {
                    id: form.displayProductId,
                    title: form.displayProductTitle,
                  }
                : null
            }
            onChange={(display) => {
              setField("displayProductId", display?.id ?? "");
              setField("displayProductTitle", display?.title ?? "");
            }}
          />
          <s-number-field
            label="Display position"
            value={String(form.position ?? 0)}
            min="0"
            step="1"
            onInput={(event) => setField("position", event.target.value)}
          />
          <s-paragraph color="subdued">
            Bundles are shown in this order on the website. Lower numbers
            appear first.
          </s-paragraph>
        </s-section>

        <s-section heading="Bundle discount">
          <s-paragraph color="subdued">
            Offer the bundle at a discount compared to buying each product
            separately.
          </s-paragraph>
          <s-stack direction="inline" gap="base" blockAlign="end">
            <s-select
              label="Discount type"
              value={form.discountType}
              onInput={(event) => setField("discountType", event.target.value)}
            >
              <s-option value="percentage">Percentage off</s-option>
              <s-option value="fixed_amount">Fixed amount off</s-option>
              <s-option value="none">No discount</s-option>
            </s-select>
            <s-number-field
              label="Discount value"
              value={String(form.discountValue ?? 0)}
              min="0"
              step="0.01"
              disabled={discountOff}
              error={errors.discountValue}
              onInput={(event) => setField("discountValue", event.target.value)}
            />
          </s-stack>
          {errors.discountValue && (
            <s-paragraph tone="critical">{errors.discountValue}</s-paragraph>
          )}
        </s-section>

        <s-button variant="primary" loading={loading} type="submit">
          Save
        </s-button>
      </s-stack>
    </form>
  );
}

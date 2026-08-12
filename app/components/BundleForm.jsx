import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import ProductPicker from "./ProductPicker";
import FormErrors from "./FormErrors";

const emptyForm = {
  title: "",
  description: "",
  status: "active",
  discountType: "percentage",
  discountValue: 15,
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

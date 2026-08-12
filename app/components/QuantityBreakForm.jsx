import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import ProductPicker from "./ProductPicker";
import TierEditor from "./TierEditor";
import FormErrors from "./FormErrors";

const emptyForm = {
  title: "",
  status: "active",
  products: [],
  tiers: [{ minQuantity: 2, discountType: "percentage", discountValue: 10 }],
};

export default function QuantityBreakForm({ initial }) {
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
      shopify.toast.show("Quantity break saved");
      navigate("/app/quantity-breaks");
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

        <s-section heading="Products">
          <s-paragraph color="subdued">
            Choose the products this quantity break applies to.
          </s-paragraph>
          <ProductPicker
            resourceType="product"
            selection={form.products}
            onSelectionChange={(products) => setField("products", products)}
          />
        </s-section>

        <s-section heading="Discount tiers">
          <s-paragraph color="subdued">
            Set the discount customers get when buying multiple units.
          </s-paragraph>
          <TierEditor
            tiers={form.tiers}
            onChange={(tiers) => setField("tiers", tiers)}
          />
          {errors.tiers && (
            <s-paragraph tone="critical">{errors.tiers}</s-paragraph>
          )}
        </s-section>

        <s-button variant="primary" loading={loading} type="submit">
          Save
        </s-button>
      </s-stack>
    </form>
  );
}

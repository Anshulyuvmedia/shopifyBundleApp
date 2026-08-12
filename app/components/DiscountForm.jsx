import { useEffect, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import ProductPicker from "./ProductPicker";
import FormErrors from "./FormErrors";

const emptyDetailsByType = {
  buy_x_get_y: {
    buyQuantity: 1,
    getQuantity: 1,
    discountType: "percentage",
    discountValue: 100,
  },
  spend_and_get: {
    minSpend: 0,
    discountType: "percentage",
    discountValue: 10,
  },
  fixed_amount: {
    amount: 0,
    minSpend: 0,
  },
  free_shipping: {},
};

const emptyForm = {
  title: "",
  type: "buy_x_get_y",
  status: "active",
  products: [],
  details: emptyDetailsByType.buy_x_get_y,
};

export default function DiscountForm({ initial }) {
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
          ? `Discount saved, but Shopify sync failed: ${sync.errors ?? "unknown error"}`
          : "Discount saved",
      );
      navigate("/app/discounts");
    } else if (fetcher.data?.errors) {
      setErrors(fetcher.data.errors);
    }
  }, [fetcher.data, navigate, shopify]);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const setType = (type) => {
    setForm((current) => ({
      ...current,
      type,
      details: emptyDetailsByType[type] ?? {},
    }));
  };

  const setDetail = (key, value) => {
    setForm((current) => ({
      ...current,
      details: { ...current.details, [key]: value },
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors({});
    fetcher.submit(JSON.stringify(form), {
      method: "POST",
      encType: "application/json",
    });
  };

  const loading = fetcher.state === "submitting";
  const details = form.details ?? {};
  const { type } = form;

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
              label="Discount type"
              value={type}
              onInput={(event) => setType(event.target.value)}
            >
              <s-option value="buy_x_get_y">Buy X Get Y</s-option>
              <s-option value="spend_and_get">Spend &amp; get</s-option>
              <s-option value="fixed_amount">Fixed amount off</s-option>
              <s-option value="free_shipping">Free shipping</s-option>
            </s-select>
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
            Leave empty to apply to all products, or choose specific products.
          </s-paragraph>
          <ProductPicker
            resourceType="product"
            selection={form.products}
            onSelectionChange={(products) => setField("products", products)}
          />
        </s-section>

        <s-section heading="Discount rules">
          {type === "buy_x_get_y" && (
            <s-stack direction="inline" gap="base" blockAlign="end">
              <s-number-field
                label="Buy"
                value={String(details.buyQuantity ?? 1)}
                min="1"
                onInput={(event) => setDetail("buyQuantity", event.target.value)}
              />
              <s-number-field
                label="Get"
                value={String(details.getQuantity ?? 1)}
                min="1"
                onInput={(event) => setDetail("getQuantity", event.target.value)}
              />
              <s-number-field
                label="Discount on the get items"
                value={String(details.discountValue ?? 100)}
                min="0"
                max="100"
                suffix="%"
                onInput={(event) =>
                  setDetail("discountValue", event.target.value)
                }
              />
            </s-stack>
          )}

          {type === "spend_and_get" && (
            <s-stack direction="inline" gap="base" blockAlign="end">
              <s-number-field
                label="Min spend"
                value={String(details.minSpend ?? 0)}
                min="0"
                step="0.01"
                prefix="$"
                onInput={(event) => setDetail("minSpend", event.target.value)}
              />
              <s-select
                label="Discount type"
                value={details.discountType ?? "percentage"}
                onInput={(event) =>
                  setDetail("discountType", event.target.value)
                }
              >
                <s-option value="percentage">Percentage off</s-option>
                <s-option value="fixed_amount">Fixed amount off</s-option>
              </s-select>
              <s-number-field
                label="Discount value"
                value={String(details.discountValue ?? 0)}
                min="0"
                step="0.01"
                onInput={(event) =>
                  setDetail("discountValue", event.target.value)
                }
              />
            </s-stack>
          )}

          {type === "fixed_amount" && (
            <s-stack direction="inline" gap="base" blockAlign="end">
              <s-number-field
                label="Amount off"
                value={String(details.amount ?? 0)}
                min="0"
                step="0.01"
                prefix="$"
                onInput={(event) => setDetail("amount", event.target.value)}
              />
              <s-number-field
                label="Min spend"
                value={String(details.minSpend ?? 0)}
                min="0"
                step="0.01"
                prefix="$"
                onInput={(event) => setDetail("minSpend", event.target.value)}
              />
            </s-stack>
          )}

          {type === "free_shipping" && (
            <s-paragraph color="subdued">
              Customers get free shipping on their order. No extra rules
              required.
            </s-paragraph>
          )}
        </s-section>

        <s-button variant="primary" loading={loading} type="submit">
          Save
        </s-button>
      </s-stack>
    </form>
  );
}

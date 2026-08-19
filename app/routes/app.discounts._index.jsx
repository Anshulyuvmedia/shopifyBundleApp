import { useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  deleteDiscount,
  getDiscount,
  listDiscounts,
  parseJsonBody,
} from "../models.server";
import { deleteShopifyDiscount } from "../discounts-sync.server";
import { cacheClear } from "../cache.server";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import DeleteButton from "../components/DeleteButton";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const discounts = await listDiscounts(session.shop);
  return { discounts };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  if (data.intent === "delete") {
    const discount = await getDiscount(session.shop, data.id);
    const result = await deleteDiscount(session.shop, data.id);
    if (result.ok) {
      cacheClear();
      if (discount?.shopifyDiscountId) {
        await deleteShopifyDiscount(session.shop, discount.shopifyDiscountId);
      }
    }
    return { ...result, deleted: result.ok };
  }
  return { ok: false, errors: { action: "Unknown action." } };
};

export function describeDiscount(discount) {
  const details = discount.details ?? {};
  switch (discount.type) {
    case "buy_x_get_y": {
      const value = Number(details.discountValue) >= 100
        ? "free"
        : `${details.discountValue}% off`;
      return `Buy ${details.buyQuantity ?? 1}, get ${details.getQuantity ?? 1} ${value}`;
    }
    case "spend_and_get": {
      const off =
        details.discountType === "percentage"
          ? `${details.discountValue}%`
          : `₹${details.discountValue}`;
      return `Spend ₹${details.minSpend ?? 0}, get ${off} off`;
    }
    case "fixed_amount": {
      const minSpend = Number(details.minSpend) > 0
        ? ` when spending ₹${details.minSpend}`
        : "";
      return `₹${details.amount ?? 0} off${minSpend}`;
    }
    case "free_shipping":
      return "Free shipping";
    default:
      return discount.type;
  }
}

export default function DiscountsPage() {
  const { discounts } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.data?.deleted) {
      shopify.toast.show("Discount deleted");
    }
  }, [fetcher.data, shopify]);

  const handleDelete = (id) => {
    fetcher.submit(
      JSON.stringify({ intent: "delete", id }),
      { method: "POST", encType: "application/json" },
    );
  };

  return (
    <s-page heading="Discounts">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/discounts/new")}
      >
        Create discount
      </s-button>

      {discounts.length === 0 ? (
        <EmptyState
          title="No discounts yet"
          description="Create promotions like buy one get one, spend and get, or free shipping."
        >
          <s-button
            variant="primary"
            onClick={() => navigate("/app/discounts/new")}
          >
            Create discount
          </s-button>
        </EmptyState>
      ) : (
        <s-table>
          <s-table-header>
            <s-table-header-row>
              <s-table-cell>Title</s-table-cell>
              <s-table-cell>Rule</s-table-cell>
              <s-table-cell>Products</s-table-cell>
              <s-table-cell>Status</s-table-cell>
              <s-table-cell>Actions</s-table-cell>
            </s-table-header-row>
          </s-table-header>
          <s-table-body>
            {discounts.map((discount) => (
              <s-table-row key={discount.id}>
                <s-table-cell>
                  <s-link href={`/app/discounts/${discount.id}`}>
                    {discount.title}
                  </s-link>
                </s-table-cell>
                <s-table-cell>{describeDiscount(discount)}</s-table-cell>
                <s-table-cell>
                  {discount.products?.length
                    ? discount.products.length
                    : "All products"}
                </s-table-cell>
                <s-table-cell>
                  <StatusBadge status={discount.status} />
                </s-table-cell>
                <s-table-cell>
                  <s-stack direction="inline" gap="base" blockAlign="center">
                    <s-button
                      variant="tertiary"
                      onClick={() => navigate(`/app/discounts/${discount.id}`)}
                    >
                      Edit
                    </s-button>
                    <DeleteButton onConfirm={() => handleDelete(discount.id)} />
                  </s-stack>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

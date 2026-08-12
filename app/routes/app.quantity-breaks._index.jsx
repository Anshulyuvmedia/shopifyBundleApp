import { useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  deleteQuantityBreak,
  listQuantityBreaks,
  parseJsonBody,
} from "../models.server";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import DeleteButton from "../components/DeleteButton";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const quantityBreaks = await listQuantityBreaks(session.shop);
  return { quantityBreaks };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  if (data.intent === "delete") {
    const result = await deleteQuantityBreak(session.shop, data.id);
    return { ...result, deleted: result.ok };
  }
  return { ok: false, errors: { action: "Unknown action." } };
};

export function formatTiers(tiers) {
  return tiers
    .map((tier) => {
      const value =
        tier.discountType === "percentage"
          ? `${tier.discountValue}%`
          : `$${tier.discountValue}`;
      return `Buy ${tier.minQuantity}+ → ${value} off`;
    })
    .join(", ");
}

export default function QuantityBreaksPage() {
  const { quantityBreaks } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.data?.deleted) {
      shopify.toast.show("Quantity break deleted");
    }
  }, [fetcher.data, shopify]);

  const handleDelete = (id) => {
    fetcher.submit(
      JSON.stringify({ intent: "delete", id }),
      { method: "POST", encType: "application/json" },
    );
  };

  return (
    <s-page heading="Quantity breaks">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/quantity-breaks/new")}
      >
        Create quantity break
      </s-button>

      {quantityBreaks.length === 0 ? (
        <EmptyState
          title="No quantity breaks yet"
          description="Offer tiered discounts on your products. For example: buy 2+ and save 10%, buy 3+ and save 20%."
        >
          <s-button
            variant="primary"
            onClick={() => navigate("/app/quantity-breaks/new")}
          >
            Create quantity break
          </s-button>
        </EmptyState>
      ) : (
        <s-table>
          <s-table-header>
            <s-table-header-row>
              <s-table-cell>Title</s-table-cell>
              <s-table-cell>Products</s-table-cell>
              <s-table-cell>Tiers</s-table-cell>
              <s-table-cell>Status</s-table-cell>
              <s-table-cell>Actions</s-table-cell>
            </s-table-header-row>
          </s-table-header>
          <s-table-body>
            {quantityBreaks.map((quantityBreak) => (
              <s-table-row key={quantityBreak.id}>
                <s-table-cell>
                  <s-link href={`/app/quantity-breaks/${quantityBreak.id}`}>
                    {quantityBreak.title}
                  </s-link>
                </s-table-cell>
                <s-table-cell>{quantityBreak.products.length}</s-table-cell>
                <s-table-cell>
                  {formatTiers(quantityBreak.tiers)}
                </s-table-cell>
                <s-table-cell>
                  <StatusBadge status={quantityBreak.status} />
                </s-table-cell>
                <s-table-cell>
                  <s-stack direction="inline" gap="base" blockAlign="center">
                    <s-button
                      variant="tertiary"
                      onClick={() =>
                        navigate(`/app/quantity-breaks/${quantityBreak.id}`)
                      }
                    >
                      Edit
                    </s-button>
                    <DeleteButton
                      onConfirm={() => handleDelete(quantityBreak.id)}
                    />
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

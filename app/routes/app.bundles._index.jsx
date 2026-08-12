import { useEffect } from "react";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { deleteBundle, getBundle, listBundles, parseJsonBody } from "../models.server";
import { deleteShopifyDiscount } from "../discounts-sync.server";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import DeleteButton from "../components/DeleteButton";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const bundles = await listBundles(session.shop);
  return { bundles };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  if (data.intent === "delete") {
    const bundle = await getBundle(session.shop, data.id);
    const result = await deleteBundle(session.shop, data.id);
    if (result.ok && bundle?.shopifyDiscountId) {
      await deleteShopifyDiscount(session.shop, bundle.shopifyDiscountId);
    }
    return { ...result, deleted: result.ok };
  }
  return { ok: false, errors: { action: "Unknown action." } };
};

export function formatDiscount(bundle) {
  if (bundle.discountType === "none") return "None";
  const value =
    bundle.discountType === "percentage"
      ? `${bundle.discountValue}%`
      : `$${bundle.discountValue}`;
  return `${value} off`;
}

export default function BundlesPage() {
  const { bundles } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  useEffect(() => {
    if (fetcher.data?.deleted) {
      shopify.toast.show("Bundle deleted");
    }
  }, [fetcher.data, shopify]);

  const handleDelete = (id) => {
    fetcher.submit(
      JSON.stringify({ intent: "delete", id }),
      { method: "POST", encType: "application/json" },
    );
  };

  return (
    <s-page heading="Bundles">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/bundles/new")}
      >
        Create bundle
      </s-button>

      {bundles.length === 0 ? (
        <EmptyState
          title="No bundles yet"
          description="Group products into a bundle and sell them together at a discount."
        >
          <s-button
            variant="primary"
            onClick={() => navigate("/app/bundles/new")}
          >
            Create bundle
          </s-button>
        </EmptyState>
      ) : (
        <s-table>
          <s-table-header>
            <s-table-header-row>
              <s-table-cell>Title</s-table-cell>
              <s-table-cell>Items</s-table-cell>
              <s-table-cell>Discount</s-table-cell>
              <s-table-cell>Status</s-table-cell>
              <s-table-cell>Actions</s-table-cell>
            </s-table-header-row>
          </s-table-header>
          <s-table-body>
            {bundles.map((bundle) => (
              <s-table-row key={bundle.id}>
                <s-table-cell>
                  <s-link href={`/app/bundles/${bundle.id}`}>
                    {bundle.title}
                  </s-link>
                </s-table-cell>
                <s-table-cell>{bundle.items.length}</s-table-cell>
                <s-table-cell>{formatDiscount(bundle)}</s-table-cell>
                <s-table-cell>
                  <StatusBadge status={bundle.status} />
                </s-table-cell>
                <s-table-cell>
                  <s-stack direction="inline" gap="base" blockAlign="center">
                    <s-button
                      variant="tertiary"
                      onClick={() => navigate(`/app/bundles/${bundle.id}`)}
                    >
                      Edit
                    </s-button>
                    <DeleteButton onConfirm={() => handleDelete(bundle.id)} />
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

import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getBundle,
  parseJsonBody,
  saveBundleShopifyDiscountId,
  updateBundle,
} from "../models.server";
import { syncBundleToShopify } from "../discounts-sync.server";
import BundleForm from "../components/BundleForm";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const bundle = await getBundle(session.shop, params.id);
  if (!bundle) {
    throw new Response("Not found", { status: 404 });
  }
  return { bundle };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  const result = await updateBundle(session.shop, params.id, data);
  if (!result.ok) return result;

  const bundle = await getBundle(session.shop, params.id);
  const sync = await syncBundleToShopify(session.shop, bundle);
  if (sync.ok) {
    await saveBundleShopifyDiscountId(session.shop, params.id, sync.shopifyDiscountId);
  }
  return { ...result, sync: { ok: sync.ok, errors: sync.errors } };
};

export default function EditBundlePage() {
  const { bundle } = useLoaderData();

  return (
    <s-page heading={bundle.title}>
      <s-link slot="breadcrumb-actions" href="/app/bundles">
        Bundles
      </s-link>
      <BundleForm initial={bundle} />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

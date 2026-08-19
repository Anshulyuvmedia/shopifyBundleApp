import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  createBundle,
  getBundle,
  parseJsonBody,
  saveBundleShopifyDiscountId,
} from "../models.server";
import { syncBundleToShopify } from "../discounts-sync.server";
import { cacheClear } from "../cache.server";
import BundleForm from "../components/BundleForm";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  const result = await createBundle(session.shop, data);
  if (!result.ok) return result;

  cacheClear();

  const bundle = await getBundle(session.shop, result.id);
  const sync = await syncBundleToShopify(session.shop, bundle);
  if (sync.ok) {
    await saveBundleShopifyDiscountId(session.shop, result.id, sync.shopifyDiscountId);
  }
  return { ...result, sync: { ok: sync.ok, errors: sync.errors } };
};

export default function NewBundlePage() {
  return (
    <s-page heading="Create bundle">
      <s-link slot="breadcrumb-actions" href="/app/bundles">
        Bundles
      </s-link>
      <BundleForm />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

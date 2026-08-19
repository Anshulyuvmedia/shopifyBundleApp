import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  createDiscount,
  getDiscount,
  parseJsonBody,
  saveShopifyDiscountId,
} from "../models.server";
import { syncDiscountToShopify } from "../discounts-sync.server";
import { cacheClear } from "../cache.server";
import DiscountForm from "../components/DiscountForm";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  const result = await createDiscount(session.shop, data);
  if (!result.ok) return result;

  cacheClear();

  const discount = await getDiscount(session.shop, result.id);
  const sync = await syncDiscountToShopify(session.shop, discount);
  if (sync.ok && sync.shopifyDiscountId) {
    await saveShopifyDiscountId(session.shop, result.id, sync.shopifyDiscountId);
  }
  return { ...result, sync: { ok: sync.ok, errors: sync.errors } };
};

export default function NewDiscountPage() {
  return (
    <s-page heading="Create discount">
      <s-link slot="breadcrumb-actions" href="/app/discounts">
        Discounts
      </s-link>
      <DiscountForm />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

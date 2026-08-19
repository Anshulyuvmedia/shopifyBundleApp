import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import {
  getDiscount,
  parseJsonBody,
  saveShopifyDiscountId,
  updateDiscount,
} from "../models.server";
import { syncDiscountToShopify } from "../discounts-sync.server";
import { cacheClear } from "../cache.server";
import DiscountForm from "../components/DiscountForm";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const discount = await getDiscount(session.shop, params.id);
  if (!discount) {
    throw new Response("Not found", { status: 404 });
  }
  return { discount };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  const result = await updateDiscount(session.shop, params.id, data);
  if (!result.ok) return result;

  cacheClear();

  const discount = await getDiscount(session.shop, params.id);
  const sync = await syncDiscountToShopify(session.shop, discount);
  if (sync.ok) {
    await saveShopifyDiscountId(session.shop, params.id, sync.shopifyDiscountId);
  }
  return { ...result, sync: { ok: sync.ok, errors: sync.errors } };
};

export default function EditDiscountPage() {
  const { discount } = useLoaderData();

  return (
    <s-page heading={discount.title}>
      <s-link slot="breadcrumb-actions" href="/app/discounts">
        Discounts
      </s-link>
      <DiscountForm initial={discount} />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

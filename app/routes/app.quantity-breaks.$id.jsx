import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getQuantityBreak, parseJsonBody, updateQuantityBreak } from "../models.server";
import { cacheClear } from "../cache.server";
import QuantityBreakForm from "../components/QuantityBreakForm";

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const quantityBreak = await getQuantityBreak(session.shop, params.id);
  if (!quantityBreak) {
    throw new Response("Not found", { status: 404 });
  }
  return { quantityBreak };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  const result = await updateQuantityBreak(session.shop, params.id, data);
  if (result.ok) cacheClear();
  return result;
};

export default function EditQuantityBreakPage() {
  const { quantityBreak } = useLoaderData();

  return (
    <s-page heading={quantityBreak.title}>
      <s-link slot="breadcrumb-actions" href="/app/quantity-breaks">
        Quantity breaks
      </s-link>
      <QuantityBreakForm initial={quantityBreak} />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

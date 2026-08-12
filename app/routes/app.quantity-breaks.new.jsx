import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { createQuantityBreak, parseJsonBody } from "../models.server";
import QuantityBreakForm from "../components/QuantityBreakForm";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const data = await parseJsonBody(request);
  return createQuantityBreak(session.shop, data);
};

export default function NewQuantityBreakPage() {
  return (
    <s-page heading="Create quantity break">
      <s-link slot="breadcrumb-actions" href="/app/quantity-breaks">
        Quantity breaks
      </s-link>
      <QuantityBreakForm />
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

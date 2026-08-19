import { authenticate } from "../shopify.server";
import { cacheClear } from "../cache.server";

export const action = async ({ request }) => {
  await authenticate.admin(request);
  cacheClear();
  return { ok: true };
};

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  cacheClear();
  return { ok: true };
};

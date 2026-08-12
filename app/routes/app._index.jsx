import { Link, useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { listBundles, listDiscounts, listQuantityBreaks } from "../models.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const [quantityBreaks, bundles, discounts] = await Promise.all([
    listQuantityBreaks(session.shop),
    listBundles(session.shop),
    listDiscounts(session.shop),
  ]);

  const stats = {
    quantityBreaks: quantityBreaks.length,
    activeQuantityBreaks: quantityBreaks.filter((q) => q.status === "active").length,
    bundles: bundles.length,
    activeBundles: bundles.filter((b) => b.status === "active").length,
    discounts: discounts.length,
    activeDiscounts: discounts.filter((d) => d.status === "active").length,
  };

  return { stats };
};

function StatCard({ heading, value, caption, to, cta }) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderColor="subdued"
      borderRadius="base"
    >
      <s-stack direction="block" gap="base">
        <s-heading>{heading}</s-heading>
        <s-heading>{value}</s-heading>
        <s-paragraph color="subdued">{caption}</s-paragraph>
        <Link to={to}>{cta}</Link>
      </s-stack>
    </s-box>
  );
}

export default function DashboardPage() {
  const { stats } = useLoaderData();
  const navigate = useNavigate();

  return (
    <s-page heading="Pummpy">
      <s-grid columns="3">
        <s-grid-item>
          <StatCard
            heading="Quantity breaks"
            value={`${stats.activeQuantityBreaks}/${stats.quantityBreaks} active`}
            caption="Tiered discounts by quantity, shown on the product page."
            to="/app/quantity-breaks"
            cta="Manage"
          />
        </s-grid-item>
        <s-grid-item>
          <StatCard
            heading="Bundles"
            value={`${stats.activeBundles}/${stats.bundles} active`}
            caption="Group products and sell them together at a discount."
            to="/app/bundles"
            cta="Manage"
          />
        </s-grid-item>
        <s-grid-item>
          <StatCard
            heading="Discounts"
            value={`${stats.activeDiscounts}/${stats.discounts} active`}
            caption="Buy one get one, spend and get, and free shipping."
            to="/app/discounts"
            cta="Manage"
          />
        </s-grid-item>
      </s-grid>

      <s-section heading="Quick create">
        <s-stack direction="inline" gap="base">
          <s-button
            variant="secondary"
            onClick={() => navigate("/app/quantity-breaks/new")}
          >
            Create quantity break
          </s-button>
          <s-button variant="secondary" onClick={() => navigate("/app/bundles/new")}>
            Create bundle
          </s-button>
          <s-button
            variant="secondary"
            onClick={() => navigate("/app/discounts/new")}
          >
            Create discount
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="About">
        <s-paragraph>
          Pummpy helps you increase average order value with quantity breaks,
          product bundles, and automatic discounts.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { syncSubscription } from "../lib/billing.server";
import prisma from "../db.server";

/**
 * Shopify redirects merchants back here after they confirm (or decline)
 * a subscription on Shopify's billing confirmation page.
 */
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const planId = url.searchParams.get("plan");
  const chargeId = url.searchParams.get("charge_id");

  if (!chargeId) {
    // Merchant cancelled the billing confirmation — leave them on free
    return redirect("/app/billing?cancelled=true");
  }

  // Sync Shopify's subscription state to our DB
  const sub = await syncSubscription(admin.graphql, session.shop);

  // Update plan to what was selected (syncSubscription matches by price,
  // but also allow explicit planId from query param as fallback)
  if (planId && sub.plan === "free") {
    await prisma.subscription.update({
      where: { shop: session.shop },
      data: { plan: planId, status: "active" },
    });
  }

  return redirect("/app/billing?success=true");
};

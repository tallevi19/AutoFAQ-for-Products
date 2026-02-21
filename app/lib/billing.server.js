/**
 * Billing server — Shopify Billing API + usage tracking
 */

import prisma from "../db.server";
import { PLANS, getPlan, checkLimit, getCurrentBillingPeriod, PLAN_ORDER } from "./plans.js";

// ─── GraphQL Mutations ───────────────────────────────────────────────────────

const CREATE_SUBSCRIPTION_MUTATION = `
  mutation CreateSubscription(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: String!
    $test: Boolean
    $trialDays: Int
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
      trialDays: $trialDays
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const CANCEL_SUBSCRIPTION_MUTATION = `
  mutation CancelSubscription($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_ACTIVE_SUBSCRIPTION_QUERY = `
  query GetSubscription {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        currentPeriodEnd
        trialDays
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

// ─── Subscription helpers ────────────────────────────────────────────────────

/**
 * Get or create subscription record for a shop
 */
export async function getSubscription(shop) {
  let sub = await prisma.subscription.findUnique({ where: { shop } });
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { shop, plan: "free", status: "active" },
    });
  }
  return sub;
}

/**
 * Sync Shopify's active subscription back to our DB
 * Called after auth to keep plan status fresh
 */
export async function syncSubscription(graphql, shop) {
  const response = await graphql(GET_ACTIVE_SUBSCRIPTION_QUERY);
  const { data } = await response.json();
  const activeSubs = data?.currentAppInstallation?.activeSubscriptions || [];

  if (activeSubs.length === 0) {
    // No active Shopify subscription — ensure they're on free
    await prisma.subscription.upsert({
      where: { shop },
      update: { plan: "free", status: "active", shopifyChargeId: null },
      create: { shop, plan: "free", status: "active" },
    });
    return await getSubscription(shop);
  }

  const shopifySub = activeSubs[0];

  // Match plan by price
  const price = parseFloat(
    shopifySub.lineItems[0]?.plan?.pricingDetails?.price?.amount || "0"
  );

  let matchedPlan = "free";
  for (const [planId, plan] of Object.entries(PLANS)) {
    if (plan.price === price) {
      matchedPlan = planId;
      break;
    }
  }

  await prisma.subscription.upsert({
    where: { shop },
    update: {
      plan: matchedPlan,
      status: shopifySub.status === "ACTIVE" ? "active" : "cancelled",
      shopifyChargeId: shopifySub.id,
      currentPeriodEnd: shopifySub.currentPeriodEnd
        ? new Date(shopifySub.currentPeriodEnd)
        : null,
    },
    create: {
      shop,
      plan: matchedPlan,
      status: "active",
      shopifyChargeId: shopifySub.id,
    },
  });

  return await getSubscription(shop);
}

/**
 * Create a Shopify subscription charge and return confirmation URL
 */
export async function createSubscription(graphql, shop, planId, returnUrl) {
  const plan = getPlan(planId);
  if (!plan || plan.price === 0) {
    throw new Error("Cannot create a charge for the free plan");
  }

  const isTest = process.env.NODE_ENV !== "production";

  const response = await graphql(CREATE_SUBSCRIPTION_MUTATION, {
    variables: {
      name: plan.shopifyPlanName,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: plan.price, currencyCode: "USD" },
              interval: plan.interval,
            },
          },
        },
      ],
      returnUrl,
      test: isTest, // Use test mode in development
      trialDays: 7,  // 7-day free trial on all paid plans
    },
  });

  const { data } = await response.json();
  const result = data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    throw new Error(result.userErrors.map((e) => e.message).join(", "));
  }

  // Store pending confirmation
  await prisma.subscription.upsert({
    where: { shop },
    update: {
      shopifyChargeId: result.appSubscription.id,
      shopifyConfirmationUrl: result.confirmationUrl,
      status: "pending",
    },
    create: {
      shop,
      plan: planId,
      status: "pending",
      shopifyChargeId: result.appSubscription.id,
      shopifyConfirmationUrl: result.confirmationUrl,
    },
  });

  return result.confirmationUrl;
}

/**
 * Cancel active Shopify subscription
 */
export async function cancelSubscription(graphql, shop) {
  const sub = await getSubscription(shop);
  if (!sub?.shopifyChargeId) {
    // Nothing to cancel on Shopify side, just downgrade locally
    await prisma.subscription.update({
      where: { shop },
      data: { plan: "free", status: "active", shopifyChargeId: null },
    });
    return;
  }

  const response = await graphql(CANCEL_SUBSCRIPTION_MUTATION, {
    variables: { id: sub.shopifyChargeId },
  });

  const { data } = await response.json();
  const errors = data?.appSubscriptionCancel?.userErrors;
  if (errors?.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  await prisma.subscription.update({
    where: { shop },
    data: { plan: "free", status: "active", shopifyChargeId: null },
  });
}

// ─── Usage Tracking ──────────────────────────────────────────────────────────

/**
 * Increment usage counter (e.g. "generation" or "product_faq")
 */
export async function incrementUsage(shop, type) {
  const period = getCurrentBillingPeriod();
  await prisma.usageRecord.upsert({
    where: { shop_type_billingPeriod: { shop, type, billingPeriod: period } },
    update: { count: { increment: 1 } },
    create: { shop, type, billingPeriod: period, count: 1 },
  });
}

/**
 * Get current usage for a shop in the current billing period
 */
export async function getUsage(shop) {
  const period = getCurrentBillingPeriod();
  const records = await prisma.usageRecord.findMany({
    where: { shop, billingPeriod: period },
  });

  const usage = { generation: 0, product_faq: 0 };
  records.forEach((r) => {
    usage[r.type] = r.count;
  });
  return usage;
}

/**
 * Get total published FAQ products for a shop (for the products limit)
 */
export async function getPublishedFaqCount(shop) {
  return prisma.productFAQ.count({
    where: { shop, isPublished: true },
  });
}

/**
 * Main guard — check if a shop can perform an action.
 * Returns { allowed, reason, upgrade } 
 */
export async function canPerformAction(shop, action) {
  const [sub, usage, publishedFaqs] = await Promise.all([
    getSubscription(shop),
    getUsage(shop),
    getPublishedFaqCount(shop),
  ]);

  const plan = sub.plan || "free";

  if (action === "generate") {
    const check = checkLimit(plan, "generationsPerMonth", usage.generation);
    if (!check.allowed) {
      return {
        allowed: false,
        reason: `You've used all ${check.limit} AI generations this month on the ${getPlan(plan).name} plan.`,
        limitKey: "generationsPerMonth",
        usage: check.usage,
        limit: check.limit,
        plan,
      };
    }
  }

  if (action === "publish_faq") {
    const check = checkLimit(plan, "products", publishedFaqs);
    if (!check.allowed) {
      return {
        allowed: false,
        reason: `You've reached the ${check.limit}-product limit on the ${getPlan(plan).name} plan.`,
        limitKey: "products",
        usage: check.usage,
        limit: check.limit,
        plan,
      };
    }
  }

  return { allowed: true, plan };
}

/**
 * Get full subscription + usage summary for a shop
 */
export async function getSubscriptionSummary(shop) {
  const [sub, usage, publishedFaqs] = await Promise.all([
    getSubscription(shop),
    getUsage(shop),
    getPublishedFaqCount(shop),
  ]);

  const plan = getPlan(sub.plan);

  return {
    subscription: sub,
    plan,
    usage: {
      generations: {
        used: usage.generation,
        limit: plan.limits.generationsPerMonth,
        percent:
          plan.limits.generationsPerMonth === Infinity
            ? 0
            : Math.round((usage.generation / plan.limits.generationsPerMonth) * 100),
      },
      products: {
        used: publishedFaqs,
        limit: plan.limits.products,
        percent:
          plan.limits.products === Infinity
            ? 0
            : Math.round((publishedFaqs / plan.limits.products) * 100),
      },
    },
  };
}

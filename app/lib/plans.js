/**
 * Plan definitions — single source of truth
 * Used across billing, enforcement, and UI
 */

export const PLANS = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    interval: "EVERY_30_DAYS",
    shopifyPlanName: null, // No charge for free
    color: "#8c9196",
    badge: null,
    limits: {
      products: 3,          // Max products that can have FAQ
      generationsPerMonth: 10, // AI generation calls per billing cycle
    },
    features: [
      "3 products with FAQ",
      "10 AI generations/month",
      "Basic accordion style",
      "1 AI provider",
    ],
    cta: "Get Started",
  },

  starter: {
    id: "starter",
    name: "Starter",
    price: 9,
    interval: "EVERY_30_DAYS",
    shopifyPlanName: "Starter Plan - $9/month",
    color: "#2c6ecb",
    badge: null,
    limits: {
      products: 50,
      generationsPerMonth: 100,
    },
    features: [
      "50 products with FAQ",
      "100 AI generations/month",
      "Edit & customize FAQs",
      "Both AI providers (OpenAI & Anthropic)",
      "Email support",
    ],
    cta: "Start Starter",
  },

  growth: {
    id: "growth",
    name: "Growth",
    price: 29,
    interval: "EVERY_30_DAYS",
    shopifyPlanName: "Growth Plan - $29/month",
    color: "#008060",
    badge: "Most Popular",
    limits: {
      products: Infinity,       // Unlimited
      generationsPerMonth: 500,
    },
    features: [
      "Unlimited products with FAQ",
      "500 AI generations/month",
      "Edit & customize FAQs",
      "Both AI providers",
      "Bulk generate for all products",
      "FAQ analytics (clicks & engagement)",
      "Priority support",
    ],
    cta: "Start Growth",
  },

  pro: {
    id: "pro",
    name: "Pro",
    price: 79,
    interval: "EVERY_30_DAYS",
    shopifyPlanName: "Pro Plan - $79/month",
    color: "#6d2f9e",
    badge: "Best Value",
    limits: {
      products: Infinity,
      generationsPerMonth: Infinity, // Unlimited
    },
    features: [
      "Unlimited products with FAQ",
      "Unlimited AI generations",
      "Edit & customize FAQs",
      "Both AI providers",
      "Bulk generate for all products",
      "FAQ analytics",
      "Custom FAQ templates",
      "White-label (remove AI badge)",
      "Dedicated support + onboarding",
    ],
    cta: "Start Pro",
  },
};

export const PLAN_ORDER = ["free", "starter", "growth", "pro"];

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free;
}

export function isHigherPlan(planA, planB) {
  return PLAN_ORDER.indexOf(planA) > PLAN_ORDER.indexOf(planB);
}

/**
 * Check if a shop can perform an action under their current plan
 */
export function checkLimit(plan, limitKey, currentUsage) {
  const planConfig = getPlan(plan);
  const limit = planConfig.limits[limitKey];
  if (limit === Infinity) return { allowed: true, limit: null, usage: currentUsage };
  return {
    allowed: currentUsage < limit,
    limit,
    usage: currentUsage,
    remaining: Math.max(0, limit - currentUsage),
  };
}

export function getCurrentBillingPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

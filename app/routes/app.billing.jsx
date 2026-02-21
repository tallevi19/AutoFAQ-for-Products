import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Banner,
  Box,
  Divider,
  Icon,
  ProgressBar,
} from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
  getSubscriptionSummary,
  createSubscription,
  cancelSubscription,
} from "../lib/billing.server";
import { PLANS, PLAN_ORDER, isHigherPlan } from "../lib/plans.js";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const summary = await getSubscriptionSummary(session.shop);
  return json({ summary, shop: session.shop });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const planId = formData.get("planId");

  if (intent === "subscribe") {
    const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing/callback?plan=${planId}&shop=${session.shop}`;
    try {
      const confirmationUrl = await createSubscription(
        admin.graphql,
        session.shop,
        planId,
        returnUrl
      );
      // Redirect merchant to Shopify's billing confirmation page
      return redirect(confirmationUrl);
    } catch (error) {
      return json({ error: error.message }, { status: 500 });
    }
  }

  if (intent === "cancel") {
    try {
      await cancelSubscription(admin.graphql, session.shop);
      return json({ success: true, message: "Subscription cancelled. You've been moved to the Free plan." });
    } catch (error) {
      return json({ error: error.message }, { status: 500 });
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function BillingPage() {
  const { summary } = useLoaderData();
  const fetcher = useFetcher();
  const { subscription, plan: currentPlan, usage } = summary;
  const isSubmitting = fetcher.state !== "idle";
  const fetcherData = fetcher.data;

  function handleUpgrade(planId) {
    fetcher.submit({ intent: "subscribe", planId }, { method: "POST" });
  }

  function handleCancel() {
    if (confirm("Are you sure you want to cancel? You'll be moved to the Free plan immediately.")) {
      fetcher.submit({ intent: "cancel" }, { method: "POST" });
    }
  }

  return (
    <Page
      title="Plans & Billing"
      subtitle="Manage your subscription and usage"
      backAction={{ content: "Home", url: "/app" }}
    >
      <BlockStack gap="600">
        {fetcherData?.error && (
          <Banner title="Something went wrong" tone="critical">
            <p>{fetcherData.error}</p>
          </Banner>
        )}
        {fetcherData?.message && (
          <Banner title={fetcherData.message} tone="success" />
        )}

        {/* Current plan + usage */}
        <Layout>
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">Current Plan</Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="p" variant="heading2xl">
                        {currentPlan.name}
                      </Text>
                      {subscription.status === "active" && currentPlan.id !== "free" && (
                        <Badge tone="success">Active</Badge>
                      )}
                      {subscription.trialEndsAt && (
                        <Badge tone="attention">Trial</Badge>
                      )}
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {currentPlan.price === 0
                        ? "Free forever"
                        : `$${currentPlan.price}/month`}
                    </Text>
                  </BlockStack>
                </InlineStack>

                <Divider />

                <BlockStack gap="300">
                  <Text as="h3" variant="headingSm">This Month's Usage</Text>

                  <UsageBar
                    label="AI Generations"
                    used={usage.generations.used}
                    limit={usage.generations.limit}
                    percent={usage.generations.percent}
                  />

                  <UsageBar
                    label="Products with FAQ"
                    used={usage.products.used}
                    limit={usage.products.limit}
                    percent={usage.products.percent}
                  />
                </BlockStack>

                {currentPlan.id !== "free" && (
                  <>
                    <Divider />
                    <Button
                      tone="critical"
                      variant="plain"
                      onClick={handleCancel}
                      loading={isSubmitting && fetcher.formData?.get("intent") === "cancel"}
                    >
                      Cancel subscription
                    </Button>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Plan Includes</Text>
                <Divider />
                <BlockStack gap="200">
                  {currentPlan.features.map((f) => (
                    <InlineStack key={f} gap="200" blockAlign="center">
                      <Box color="text-success">
                        <Icon source={CheckIcon} tone="success" />
                      </Box>
                      <Text as="p" variant="bodyMd">{f}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Plan comparison */}
        <BlockStack gap="300">
          <Text as="h2" variant="headingLg">All Plans</Text>
          <Layout>
            {PLAN_ORDER.map((planId) => {
              const plan = PLANS[planId];
              const isCurrent = currentPlan.id === planId;
              const isUpgrade = isHigherPlan(planId, currentPlan.id);
              const isDowngrade = isHigherPlan(currentPlan.id, planId);

              return (
                <Layout.Section key={planId} variant="oneQuarter">
                  <PlanCard
                    plan={plan}
                    isCurrent={isCurrent}
                    isUpgrade={isUpgrade}
                    isDowngrade={isDowngrade}
                    onUpgrade={handleUpgrade}
                    isLoading={
                      isSubmitting &&
                      fetcher.formData?.get("planId") === planId
                    }
                  />
                </Layout.Section>
              );
            })}
          </Layout>
        </BlockStack>

        {/* Billing notes */}
        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">Billing Notes</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              • All paid plans include a <strong>7-day free trial</strong> — no charge until the trial ends.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              • Billing is handled securely through <strong>Shopify Billing</strong> — charges appear on your Shopify invoice.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              • AI generation limits reset on the <strong>1st of each month</strong>.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              • Downgrading to Free takes effect immediately. Existing FAQs remain published but you won't be able to add new ones past the free limit.
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              • Test mode is active in development — no real charges are made.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}

function UsageBar({ label, used, limit, percent }) {
  const isUnlimited = limit === Infinity;
  const tone = percent >= 90 ? "critical" : percent >= 70 ? "caution" : "success";

  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="p" variant="bodySm">{label}</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          {isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </Text>
      </InlineStack>
      {!isUnlimited && (
        <ProgressBar progress={Math.min(percent, 100)} tone={tone} size="small" />
      )}
      {isUnlimited && (
        <Text as="p" variant="bodySm" tone="success">Unlimited</Text>
      )}
    </BlockStack>
  );
}

function PlanCard({ plan, isCurrent, isUpgrade, isDowngrade, onUpgrade, isLoading }) {
  return (
    <Box
      background={isCurrent ? "bg-surface-active" : "bg-surface"}
      borderWidth="025"
      borderColor={isCurrent ? "border-emphasis" : "border"}
      borderRadius="300"
      padding="400"
    >
      <BlockStack gap="400">
        {/* Header */}
        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h3" variant="headingMd">{plan.name}</Text>
            {plan.badge && (
              <Badge tone={plan.id === "pro" ? "attention" : "info"}>
                {plan.badge}
              </Badge>
            )}
            {isCurrent && <Badge tone="success">Current</Badge>}
          </InlineStack>
          <Text as="p" variant="heading2xl">
            {plan.price === 0 ? "Free" : `$${plan.price}`}
          </Text>
          {plan.price > 0 && (
            <Text as="p" variant="bodySm" tone="subdued">
              /month · 7-day free trial
            </Text>
          )}
        </BlockStack>

        <Divider />

        {/* Features */}
        <BlockStack gap="200">
          {plan.features.map((f) => (
            <InlineStack key={f} gap="150" blockAlign="start" wrap={false}>
              <Box minWidth="16px">
                <Icon source={CheckIcon} tone="success" />
              </Box>
              <Text as="p" variant="bodySm">{f}</Text>
            </InlineStack>
          ))}
        </BlockStack>

        {/* CTA */}
        <Box paddingBlockStart="200">
          {isCurrent ? (
            <Button disabled fullWidth>
              Current Plan
            </Button>
          ) : plan.price === 0 ? (
            <Button variant="plain" fullWidth disabled={isDowngrade}>
              {isDowngrade ? "Downgrade via Cancel" : "Free Plan"}
            </Button>
          ) : (
            <Button
              variant={isUpgrade ? "primary" : "secondary"}
              fullWidth
              onClick={() => onUpgrade(plan.id)}
              loading={isLoading}
              disabled={isLoading}
            >
              {isUpgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
            </Button>
          )}
        </Box>
      </BlockStack>
    </Box>
  );
}

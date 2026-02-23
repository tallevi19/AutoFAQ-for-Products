import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  Banner, Box, Badge, Divider, ProgressBar,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopSettings } from "../lib/settings.server";
import { fetchProducts } from "../lib/shopify.server";
import { getSubscriptionSummary } from "../lib/billing.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const [settings, summary, { products }] = await Promise.all([
    getShopSettings(shop),
    getSubscriptionSummary(shop),
    fetchProducts(admin.graphql, { first: 250 }),
  ]);
  const totalProducts = products.length;
  const productsWithFaq = products.filter((p) => p.hasFaq).length;
  return json({
    hasSettings: !!settings?.apiKey,
    stats: {
      totalProducts,
      productsWithFaq,
      productsWithoutFaq: totalProducts - productsWithFaq,
      coveragePercent: totalProducts > 0 ? Math.round((productsWithFaq / totalProducts) * 100) : 0,
    },
    provider: settings?.aiProvider || "openai",
    subscription: summary,
  });
};

export default function Index() {
  const { hasSettings, stats, provider, subscription } = useLoaderData();
  const navigate = useNavigate();
  const { plan, usage } = subscription;

  const genPercent = usage.generations.percent;
  const prodPercent = usage.products.percent;

  return (
    <Page
      title="AI FAQ Generator"
      subtitle="Automatically generate helpful FAQ sections for your product pages"
      primaryAction={
        hasSettings
          ? { content: "Manage Products", onAction: () => navigate("/app/products") }
          : { content: "Connect AI Provider", onAction: () => navigate("/app/settings") }
      }
    >
      <BlockStack gap="500">
        {!hasSettings && (
          <Banner title="Get started by connecting your AI provider" tone="warning" action={{ content: "Go to Settings", onAction: () => navigate("/app/settings") }}>
            <p>Add your OpenAI or Anthropic API key to start generating FAQs.</p>
          </Banner>
        )}
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <InlineStack gap="400" wrap={false}>
                <StatCard title="Total Products" value={stats.totalProducts} />
                <StatCard title="Products with FAQ" value={stats.productsWithFaq} tone="success" />
                <StatCard title="Missing FAQ" value={stats.productsWithoutFaq} tone={stats.productsWithoutFaq > 0 ? "caution" : "success"} />
                <StatCard title="Coverage" value={`${stats.coveragePercent}%`} tone={stats.coveragePercent === 100 ? "success" : "base"} />
              </InlineStack>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">Current Plan</Text>
                      <InlineStack gap="200" blockAlign="center">
                        <Text as="p" variant="headingLg">{plan.name}</Text>
                        <Badge tone="success">{plan.price === 0 ? "Free" : `$${plan.price}/mo`}</Badge>
                      </InlineStack>
                    </BlockStack>
                    <Button onClick={() => navigate("/app/billing")}>
                      {plan.id === "free" ? "Upgrade Plan" : "Manage Billing"}
                    </Button>
                  </InlineStack>
                  <Divider />
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">This Month's Usage</Text>
                    <UsageRow label="AI Generations" used={usage.generations.used} limit={usage.generations.limit} percent={genPercent} />
                    <UsageRow label="Products with FAQ" used={usage.products.used} limit={usage.products.limit} percent={prodPercent} />
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">How It Works</Text>
                  <Divider />
                  <InlineStack gap="600" wrap={false} align="start">
                    <StepCard number="1" title="Connect AI Provider" description="Add your OpenAI or Anthropic API key in settings. Your key is encrypted and stored securely." />
                    <StepCard number="2" title="Select a Product" description="Browse your products and click Generate FAQ. The AI reads all product data automatically." />
                    <StepCard number="3" title="Review & Publish" description="Edit the generated questions and answers if needed, then publish to your storefront." />
                  </InlineStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Quick Actions</Text>
                  <InlineStack gap="300">
                    <Button variant="primary" onClick={() => navigate("/app/products")} disabled={!hasSettings}>Browse Products</Button>
                    <Button onClick={() => navigate("/app/settings")}>{hasSettings ? "Update Settings" : "Setup AI Provider"}</Button>
                    <Button onClick={() => navigate("/app/billing")}>View Plans</Button>
                  </InlineStack>
                  {hasSettings && (
                    <Text as="p" tone="subdued" variant="bodyMd">
                      Using: <Badge tone="info">{provider === "anthropic" ? "Anthropic (Claude)" : "OpenAI (GPT)"}</Badge>
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function StatCard({ title, value, tone }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" variant="bodyMd" tone="subdued">{title}</Text>
        <Text as="p" variant="heading2xl" tone={tone === "success" ? "success" : tone === "caution" ? "caution" : undefined}>{value}</Text>
      </BlockStack>
    </Card>
  );
}

function UsageRow({ label, used, limit, percent }) {
  const isUnlimited = limit === Infinity;
  const tone = percent >= 90 ? "critical" : percent >= 70 ? "caution" : "success";
  return (
    <BlockStack gap="100">
      <InlineStack align="space-between">
        <Text as="p" variant="bodySm">{label}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{isUnlimited ? `${used} / ∞` : `${used} / ${limit}`}</Text>
      </InlineStack>
      {!isUnlimited ? <ProgressBar progress={Math.min(percent, 100)} tone={tone} size="small" /> : <Text as="p" variant="bodySm" tone="success">Unlimited</Text>}
    </BlockStack>
  );
}

function StepCard({ number, title, description }) {
  return (
    <Box minWidth="200px">
      <BlockStack gap="200">
        <Box background="bg-surface-active" borderRadius="full" padding="200" width="36px">
          <Text as="p" variant="headingMd" alignment="center">{number}</Text>
        </Box>
        <Text as="h3" variant="headingSm">{title}</Text>
        <Text as="p" variant="bodyMd" tone="subdued">{description}</Text>
      </BlockStack>
    </Box>
  );
}
import { json } from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button, Banner,
  Spinner, TextField, Badge, Divider, Box, Modal, Tooltip,
} from "@shopify/polaris";
import { DeleteIcon, EditIcon, PlusIcon } from "@shopify/polaris-icons";
import { useState, useCallback } from "react";
import { authenticate, unauthenticated } from "../shopify.server";
import { fetchProduct, getFaqsFromMetafield, saveFaqsToMetafield } from "../lib/shopify.server";
import { getShopSettings } from "../lib/settings.server";
import { generateFAQs } from "../lib/ai.server";
import { canPerformAction, incrementUsage, getSubscriptionSummary } from "../lib/billing.server";
import { UpgradeModal } from "../components/UpgradeModal.jsx";
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shopUrl = new URL(request.url);
  const shopDomain = session.shop || shopUrl.searchParams.get("shop") || "";
  const productId = `gid://shopify/Product/${params.productId}`;
  const [product, settings, summary] = await Promise.all([
    fetchProduct(admin.graphql, productId),
    getShopSettings(shopDomain),
    getSubscriptionSummary(shopDomain),
  ]);
  if (!product) throw new Response("Product not found", { status: 404 });
  const { faqs } = await getFaqsFromMetafield(admin.graphql, productId);
  // shopDomain is passed to the client so XHR-based action calls can authenticate
  // without needing an App Bridge session token.
  return json({ product, faqs, hasSettings: !!settings?.apiKey, shopDomain, subscription: summary });
};

export const action = async ({ request, params }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  const formData = await request.formData();
  const intent = formData.get("intent");
  const shopDomain = formData.get("shopDomain");

  if (!shopDomain) {
    return json({ error: "Missing shop domain. Please reload the page." }, { status: 400 });
  }

  // Use unauthenticated.admin so this route works with a plain XHR/fetch call
  // that does NOT carry an App Bridge Bearer token. The shop session is looked
  // up from the database using the shopDomain that the loader already validated.
  let admin;
  try {
    ({ admin } = await unauthenticated.admin(shopDomain));
  } catch {
    return json({ error: "Could not authenticate. Please reload the page." }, { status: 401 });
  }

  const productId = `gid://shopify/Product/${params.productId}`;

  if (intent === "generate") {
    const check = await canPerformAction(shopDomain, "generate");
    if (!check.allowed) return json({ limitHit: true, limitError: check }, { status: 403 });
    const settings = await getShopSettings(shopDomain);
    if (!settings?.apiKey) return json({ error: "No API key configured. Go to Settings." }, { status: 400 });
    const product = await fetchProduct(admin.graphql, productId);
    if (!product) return json({ error: "Product not found" }, { status: 404 });
    try {
      const faqs = await generateFAQs({ apiKey: settings.apiKey, provider: settings.aiProvider, model: settings.model, product, faqCount: settings.faqCount });
      await incrementUsage(shopDomain, "generation");
      await prisma.productFAQ.upsert({ where: { shop_productId: { shop: shopDomain, productId } }, update: { faqs: JSON.stringify(faqs), isPublished: false }, create: { shop: shopDomain, productId, faqs: JSON.stringify(faqs), isPublished: false } });
      return json({ success: true, faqs, generated: true });
    } catch (error) {
      return json({ error: error.message }, { status: 500 });
    }
  }

  if (intent === "save") {
    const check = await canPerformAction(shopDomain, "publish_faq");
    if (!check.allowed) {
      const existing = await prisma.productFAQ.findUnique({ where: { shop_productId: { shop: shopDomain, productId } } });
      if (!existing?.isPublished) return json({ limitHit: true, limitError: check }, { status: 403 });
    }
    const faqsRaw = formData.get("faqs");
    let faqs;
    try { faqs = JSON.parse(faqsRaw); } catch { return json({ error: "Invalid FAQ data" }, { status: 400 }); }
    try {
      await saveFaqsToMetafield(admin.graphql, productId, faqs);
      await prisma.productFAQ.upsert({ where: { shop_productId: { shop: shopDomain, productId } }, update: { faqs: JSON.stringify(faqs), isPublished: true }, create: { shop: shopDomain, productId, faqs: JSON.stringify(faqs), isPublished: true } });
      return json({ success: true, saved: true, faqs });
    } catch (error) {
      return json({ error: error.message }, { status: 500 });
    }
  }

  if (intent === "delete_all") {
    try {
      await saveFaqsToMetafield(admin.graphql, productId, []);
      await prisma.productFAQ.deleteMany({ where: { shop: shopDomain, productId } });
      return json({ success: true, deleted: true });
    } catch (error) {
      return json({ error: error.message }, { status: 500 });
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function ProductPage() {
  const { product, faqs: initialFaqs, hasSettings, subscription, shopDomain } = useLoaderData();
  const params = useParams();

  const [faqs, setFaqs] = useState(initialFaqs);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContext, setUpgradeContext] = useState(null);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Use XMLHttpRequest instead of window.fetch / useFetcher.
  // App Bridge patches window.fetch to inject session tokens — and redirects the
  // browser when it cannot obtain one.  XHR is NOT patched by App Bridge, so the
  // request goes straight to the server.  The server authenticates via
  // unauthenticated.admin(shopDomain), which looks up the stored session from the
  // database without needing any Bearer token from the client.
  const apiPost = useCallback((body) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/app/products/${params.productId}`, true);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error(`Server error (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error("Network request failed"));
      xhr.send(new URLSearchParams({ ...body, shopDomain }).toString());
    });
  }, [params.productId, shopDomain]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setSavedBanner(false);
    setIsGenerating(true);
    try {
      const data = await apiPost({ intent: "generate" });
      if (data.limitHit) { setUpgradeContext(data.limitError); setShowUpgradeModal(true); }
      else if (data.error) setError(data.error);
      else if (data.faqs) setFaqs(data.faqs);
    } catch (e) {
      setError(e.message || "Failed to generate FAQs. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [apiPost]);

  const handleSave = useCallback(async () => {
    setError(null);
    setIsSaving(true);
    try {
      const data = await apiPost({ intent: "save", faqs: JSON.stringify(faqs) });
      if (data.limitHit) { setUpgradeContext(data.limitError); setShowUpgradeModal(true); }
      else if (data.error) setError(data.error);
      else if (data.saved) setSavedBanner(true);
    } catch (e) {
      setError(e.message || "Failed to save FAQs. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [apiPost, faqs]);

  const handleDeleteAll = useCallback(async () => {
    try {
      const data = await apiPost({ intent: "delete_all" });
      if (data.error) setError(data.error);
      else { setFaqs([]); setShowDeleteModal(false); }
    } catch (e) {
      setError(e.message || "Failed to delete FAQs.");
    }
  }, [apiPost]);

  const handleEditStart = useCallback((index) => {
    setEditingIndex(index);
    setEditQuestion(faqs[index].question);
    setEditAnswer(faqs[index].answer);
  }, [faqs]);

  const handleEditSave = useCallback(() => {
    const updated = [...faqs];
    updated[editingIndex] = { question: editQuestion, answer: editAnswer };
    setFaqs(updated);
    setEditingIndex(null);
    setSavedBanner(false);
  }, [faqs, editingIndex, editQuestion, editAnswer]);

  const handleDelete = useCallback((index) => {
    setFaqs(faqs.filter((_, i) => i !== index));
    setSavedBanner(false);
  }, [faqs]);

  const handleAddFaq = useCallback(() => {
    setFaqs((prev) => [...prev, { question: "New question?", answer: "Answer here." }]);
    setEditingIndex(faqs.length);
    setEditQuestion("New question?");
    setEditAnswer("Answer here.");
    setSavedBanner(false);
  }, [faqs]);

  const hasFaqs = faqs.length > 0;
  const { plan, usage } = subscription;
  const genPercent = usage.generations.percent;
  const showGenWarning = genPercent >= 80 && genPercent < 100;

  const generateButton = hasSettings ? (
    <Button variant="primary" onClick={handleGenerate} loading={isGenerating} disabled={isGenerating}>
      {isGenerating ? "Generating..." : hasFaqs ? "Regenerate FAQ" : "Generate FAQ"}
    </Button>
  ) : (
    <Button url="/app/settings">Setup AI Provider</Button>
  );

  return (
    <Page
      title={product.title}
      subtitle="Manage AI-generated FAQ section"
      backAction={{ content: "Products", url: "/app/products" }}
      primaryAction={hasFaqs ? {
        content: isSaving ? "Saving..." : "Save & Publish",
        onAction: handleSave,
        loading: isSaving,
        disabled: isSaving,
      } : undefined}
      secondaryActions={hasFaqs ? [{ content: "Delete All FAQs", destructive: true, onAction: () => setShowDeleteModal(true) }] : []}
    >
      <BlockStack gap="500">
        {!hasSettings && (
          <Banner title="AI provider not configured" tone="warning" action={{ content: "Go to Settings", url: "/app/settings" }}>
            <p>Connect your API key in Settings to enable FAQ generation.</p>
          </Banner>
        )}
        {showGenWarning && (
          <Banner title={`${usage.generations.used} of ${usage.generations.limit} AI generations used this month`} tone="warning" action={{ content: "Upgrade Plan", url: "/app/billing" }}>
            <p>Upgrade to avoid hitting your limit.</p>
          </Banner>
        )}
        {error && (
          <Banner title="Error" tone="critical" onDismiss={() => setError(null)}>
            <p>{error}</p>
          </Banner>
        )}
        {savedBanner && (
          <Banner title="FAQs published successfully!" tone="success" onDismiss={() => setSavedBanner(false)}>
            <p>Your FAQ section is now live on the product page.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">Product Overview</Text>
                    <InlineStack gap="200">
                      <Badge tone={product.status === "ACTIVE" ? "success" : "new"}>{product.status}</Badge>
                      <Badge tone="info">{plan.name} plan</Badge>
                    </InlineStack>
                  </InlineStack>
                  <Divider />
                  <InlineStack gap="600" wrap>
                    <InfoItem label="Vendor" value={product.vendor || "—"} />
                    <InfoItem label="Type" value={product.productType || "—"} />
                    <InfoItem label="Variants" value={product.variants?.length || 0} />
                    <InfoItem label="Metafields" value={product.metafields?.length || 0} />
                    <InfoItem label="Generations left" value={plan.limits.generationsPerMonth === Infinity ? "∞" : Math.max(0, plan.limits.generationsPerMonth - usage.generations.used)} />
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text as="h2" variant="headingMd">FAQ Section</Text>
                      {hasFaqs && (
                        <Text as="p" tone="subdued" variant="bodySm">
                          {faqs.length} question{faqs.length !== 1 ? "s" : ""}
                        </Text>
                      )}
                    </BlockStack>
                    <InlineStack gap="200">
                      {generateButton}
                      {hasFaqs && (
                        <Button icon={PlusIcon} onClick={handleAddFaq} size="slim">Add Question</Button>
                      )}
                    </InlineStack>
                  </InlineStack>
                  <Divider />

                  {isGenerating ? (
                    <Box padding="800">
                      <BlockStack gap="400" align="center" inlineAlign="center">
                        <Spinner size="large" />
                        <Text as="p" tone="subdued" alignment="center">
                          AI is analyzing your product and generating FAQs...
                        </Text>
                      </BlockStack>
                    </Box>
                  ) : hasFaqs ? (
                    <BlockStack gap="400">
                      {faqs.map((faq, index) => (
                        <Box key={index}>
                          {editingIndex === index ? (
                            <Card background="bg-surface-secondary">
                              <BlockStack gap="300">
                                <TextField label="Question" value={editQuestion} onChange={setEditQuestion} autoComplete="off" />
                                <TextField label="Answer" value={editAnswer} onChange={setEditAnswer} multiline={4} autoComplete="off" />
                                <InlineStack gap="200">
                                  <Button variant="primary" onClick={handleEditSave}>Done</Button>
                                  <Button onClick={() => setEditingIndex(null)}>Cancel</Button>
                                </InlineStack>
                              </BlockStack>
                            </Card>
                          ) : (
                            <Box background="bg-surface-secondary" borderRadius="200" padding="400">
                              <InlineStack align="space-between" blockAlign="start" wrap={false}>
                                <BlockStack gap="200">
                                  <Text as="p" variant="bodyMd" fontWeight="semibold">Q{index + 1}: {faq.question}</Text>
                                  <Text as="p" variant="bodyMd" tone="subdued">{faq.answer}</Text>
                                </BlockStack>
                                <InlineStack gap="100">
                                  <Tooltip content="Edit">
                                    <Button icon={EditIcon} size="slim" variant="tertiary" onClick={() => handleEditStart(index)} />
                                  </Tooltip>
                                  <Tooltip content="Delete">
                                    <Button icon={DeleteIcon} size="slim" variant="tertiary" tone="critical" onClick={() => handleDelete(index)} />
                                  </Tooltip>
                                </InlineStack>
                              </InlineStack>
                            </Box>
                          )}
                        </Box>
                      ))}
                    </BlockStack>
                  ) : (
                    <Box padding="800">
                      <BlockStack gap="400" align="center" inlineAlign="center">
                        <Text as="p" tone="subdued" alignment="center">
                          No FAQs yet. Click <strong>Generate FAQ</strong> above to get started.
                        </Text>
                      </BlockStack>
                    </Box>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete all FAQs?"
        primaryAction={{ content: "Delete", destructive: true, onAction: handleDeleteAll }}
        secondaryActions={[{ content: "Cancel", onAction: () => setShowDeleteModal(false) }]}
      >
        <Modal.Section>
          <Text as="p">This will remove the FAQ section from this product page. This cannot be undone.</Text>
        </Modal.Section>
      </Modal>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeContext?.reason}
        limitKey={upgradeContext?.limitKey}
        currentPlan={upgradeContext?.plan}
        usage={upgradeContext?.usage}
        limit={upgradeContext?.limit}
      />
    </Page>
  );
}

function InfoItem({ label, value }) {
  return (
    <BlockStack gap="100">
      <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
      <Text as="p" variant="bodyMd" fontWeight="semibold">{value}</Text>
    </BlockStack>
  );
}

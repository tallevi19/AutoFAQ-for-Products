import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  Banner, Select, TextField, Checkbox, Divider, Badge, RangeSlider, Box,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getShopSettings, saveShopSettings } from "../lib/settings.server";
import { DEFAULT_MODELS, AVAILABLE_MODELS } from "../lib/models.js";
import { validateApiKey } from "../lib/ai.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return json({
    settings: settings ? {
      aiProvider: settings.aiProvider,
      model: settings.model,
      faqCount: settings.faqCount,
      autoGenerate: settings.autoGenerate,
      hasApiKey: !!settings.apiKey,
      apiKeyPreview: settings.apiKey ? `••••••••••••••••${settings.apiKey.slice(-4)}` : "",
    } : null,
    models: AVAILABLE_MODELS,
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "save") {
    const apiKey = formData.get("apiKey");
    const aiProvider = formData.get("aiProvider");
    const model = formData.get("model");
    const faqCount = formData.get("faqCount");
    const autoGenerate = formData.get("autoGenerate") === "true";
    const updateData = { aiProvider, model, faqCount: parseInt(faqCount), autoGenerate };
    if (apiKey && !apiKey.includes("•")) updateData.apiKey = apiKey;
    await saveShopSettings(session.shop, updateData);
    return json({ success: true, message: "Settings saved successfully!" });
  }
  if (intent === "validate") {
    const apiKey = formData.get("apiKey");
    const provider = formData.get("provider");
    if (!apiKey || apiKey.includes("•")) return json({ valid: false, error: "Please enter your API key to validate" });
    const result = await validateApiKey(apiKey, provider);
    return json(result);
  }
  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function SettingsPage() {
  const { settings, models } = useLoaderData();
  const fetcher = useFetcher();
  const [provider, setProvider] = useState(settings?.aiProvider || "openai");
  const [model, setModel] = useState(settings?.model || "gpt-4o-mini");
  const [apiKey, setApiKey] = useState(settings?.apiKeyPreview || "");
  const [faqCount, setFaqCount] = useState(settings?.faqCount || 5);
  const [autoGenerate, setAutoGenerate] = useState(settings?.autoGenerate || false);
  const [validationResult, setValidationResult] = useState(null);

  const fetcherData = fetcher.data;
  const isValidating = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "validate";
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "save";

  useEffect(() => {
    if (fetcherData?.valid !== undefined) setValidationResult(fetcherData);
  }, [fetcherData]);

  const handleProviderChange = useCallback((value) => {
    setProvider(value);
    const defaultModel = DEFAULT_MODELS[value];
    if (defaultModel) setModel(defaultModel);
    setValidationResult(null);
  }, []);

  const handleValidate = useCallback(() => {
    setValidationResult(null);
    fetcher.submit({ intent: "validate", apiKey, provider }, { method: "POST" });
  }, [fetcher, apiKey, provider]);

  const handleSave = useCallback(() => {
    fetcher.submit({ intent: "save", aiProvider: provider, model, apiKey, faqCount: faqCount.toString(), autoGenerate: autoGenerate.toString() }, { method: "POST" });
  }, [fetcher, provider, model, apiKey, faqCount, autoGenerate]);

  const modelOptions = (models[provider] || []).map((m) => ({ label: m.label, value: m.value }));
  const providerOptions = [
    { label: "OpenAI (GPT)", value: "openai" },
    { label: "Anthropic (Claude)", value: "anthropic" },
  ];

  return (
    <Page title="Settings" subtitle="Configure your AI provider and FAQ generation preferences" backAction={{ content: "Home", url: "/app" }}
      primaryAction={{ content: isSaving ? "Saving..." : "Save Settings", onAction: handleSave, loading: isSaving, disabled: isSaving }}>
      <BlockStack gap="500">
        {fetcherData?.success && <Banner title={fetcherData.message} tone="success" />}
        {fetcherData?.error && <Banner title={fetcherData.error} tone="critical" />}
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">AI Provider</Text>
                  <Divider />
                  <Select label="Provider" options={providerOptions} value={provider} onChange={handleProviderChange} helpText="Choose which AI service to use for generating FAQs" />
                  <Select label="Model" options={modelOptions} value={model} onChange={setModel} helpText="Higher quality models produce better FAQs but cost more per request" />
                  <BlockStack gap="200">
                    <TextField label="API Key" type="password" value={apiKey}
                      onChange={(val) => { setApiKey(val); setValidationResult(null); }}
                      placeholder={provider === "anthropic" ? "sk-ant-api03-..." : "sk-proj-..."}
                      helpText={provider === "anthropic" ? "Get your API key from console.anthropic.com" : "Get your API key from platform.openai.com"}
                      autoComplete="off"
                      connectedRight={<Button onClick={handleValidate} loading={isValidating} disabled={isValidating || !apiKey || apiKey.includes("•")}>Validate</Button>}
                    />
                    {validationResult && (
                      <InlineStack gap="200" blockAlign="center">
                        <Badge tone={validationResult.valid ? "success" : "critical"}>{validationResult.valid ? "✓ Valid API Key" : "✗ Invalid API Key"}</Badge>
                        {!validationResult.valid && validationResult.error && <Text as="span" variant="bodySm" tone="critical">{validationResult.error}</Text>}
                      </InlineStack>
                    )}
                    <Text as="p" variant="bodySm" tone="subdued">🔒 Your API key is encrypted before being stored</Text>
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">FAQ Generation Preferences</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd">Number of FAQs to generate per product: <strong>{faqCount}</strong></Text>
                    <RangeSlider label="FAQ Count" labelHidden min={3} max={15} value={faqCount} onChange={setFaqCount} output />
                    <Text as="p" variant="bodySm" tone="subdued">We recommend 5–8 FAQs per product for best user experience</Text>
                  </BlockStack>
                  <Checkbox label="Auto-generate FAQs for new products" checked={autoGenerate} onChange={setAutoGenerate} helpText="When enabled, FAQs will be automatically generated when new products are created" />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Estimated Costs</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <CostRow label="GPT-4o" cost="~$0.01–0.03" />
                    <CostRow label="GPT-4o Mini" cost="~$0.001–0.003" />
                    <CostRow label="Claude 3.5 Sonnet" cost="~$0.01–0.03" />
                    <CostRow label="Claude 3.5 Haiku" cost="~$0.002–0.005" />
                  </BlockStack>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Need Help?</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Button url="https://platform.openai.com/api-keys" external variant="plain">Get OpenAI API Key →</Button>
                    <Button url="https://console.anthropic.com/" external variant="plain">Get Anthropic API Key →</Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

function CostRow({ label, cost }) {
  return (
    <InlineStack align="space-between">
      <Text as="p" variant="bodySm">{label}</Text>
      <Text as="p" variant="bodySm" fontWeight="semibold">{cost}</Text>
    </InlineStack>
  );
}

/**
 * AI FAQ Generation Service
 * Supports OpenAI and Anthropic providers
 */

/**
 * Build a rich prompt from all available product data
 */
function buildProductContext(product) {
  const lines = [];

  lines.push(`Product Title: ${product.title}`);

  if (product.description) {
    // Strip HTML tags for cleaner context
    const cleanDesc = product.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    lines.push(`\nDescription: ${cleanDesc}`);
  }

  if (product.productType) {
    lines.push(`\nProduct Type: ${product.productType}`);
  }

  if (product.vendor) {
    lines.push(`Vendor: ${product.vendor}`);
  }

  if (product.tags && product.tags.length > 0) {
    lines.push(`Tags: ${product.tags.join(", ")}`);
  }

  // Variants & specs
  if (product.variants && product.variants.length > 0) {
    lines.push("\nAvailable Variants:");
    product.variants.forEach((v) => {
      const variantInfo = [`  - ${v.title}`];
      if (v.price) variantInfo.push(`Price: $${v.price}`);
      if (v.sku) variantInfo.push(`SKU: ${v.sku}`);
      if (v.weight) variantInfo.push(`Weight: ${v.weight}${v.weightUnit || "g"}`);
      if (v.inventoryQuantity !== undefined)
        variantInfo.push(`Stock: ${v.inventoryQuantity}`);
      lines.push(variantInfo.join(" | "));
    });
  }

  // Options (Size, Color, Material, etc.)
  if (product.options && product.options.length > 0) {
    lines.push("\nProduct Options:");
    product.options.forEach((opt) => {
      lines.push(`  ${opt.name}: ${opt.values.join(", ")}`);
    });
  }

  // Metafields
  if (product.metafields && product.metafields.length > 0) {
    lines.push("\nAdditional Product Information:");
    product.metafields.forEach((mf) => {
      if (mf.value) {
        lines.push(`  ${mf.namespace}.${mf.key}: ${mf.value}`);
      }
    });
  }

  // Reviews
  if (product.reviews && product.reviews.length > 0) {
    lines.push("\nCustomer Reviews Summary:");
    product.reviews.slice(0, 5).forEach((r) => {
      lines.push(`  - "${r.body}" (Rating: ${r.rating}/5)`);
    });
  }

  return lines.join("\n");
}

/**
 * Build the system + user prompt
 */
function buildPrompt(product, faqCount) {
  const context = buildProductContext(product);

  const systemPrompt = `You are an expert e-commerce copywriter specializing in creating helpful FAQ sections for product pages.
Your goal is to generate the most common and useful questions customers would ask about a product, along with clear, concise answers.
Base your FAQs entirely on the product information provided. Do not invent features or specifications not mentioned.
Always respond with valid JSON only — no markdown, no explanation.`;

  const userPrompt = `Based on the following product data, generate exactly ${faqCount} frequently asked questions with answers.

${context}

Return ONLY a JSON array in this exact format:
[
  {
    "question": "Question here?",
    "answer": "Answer here."
  }
]

Focus on: shipping & returns, sizing/fit, materials, care instructions, compatibility, warranty, usage, and any product-specific concerns.
Make answers helpful, honest, and based only on provided data.`;

  return { systemPrompt, userPrompt };
}

/**
 * Generate FAQs using OpenAI
 */
async function generateWithOpenAI(apiKey, model, product, faqCount) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const { systemPrompt, userPrompt } = buildPrompt(product, faqCount);

  const response = await client.chat.completions.create({
    model: model || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  const parsed = JSON.parse(content);

  // Handle both {faqs: [...]} and [...] formats
  return Array.isArray(parsed) ? parsed : parsed.faqs || parsed[Object.keys(parsed)[0]];
}

/**
 * Generate FAQs using Anthropic
 */
async function generateWithAnthropic(apiKey, model, product, faqCount) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const { systemPrompt, userPrompt } = buildPrompt(product, faqCount);

  const response = await client.messages.create({
    model: model || "claude-3-5-sonnet-20241022",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0].text;

  // Extract JSON from response
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No valid JSON array found in AI response");

  return JSON.parse(jsonMatch[0]);
}

/**
 * Main entry point for FAQ generation
 */
export async function generateFAQs({ apiKey, provider, model, product, faqCount = 5 }) {
  if (!apiKey) throw new Error("API key is required");
  if (!product) throw new Error("Product data is required");

  try {
    if (provider === "anthropic") {
      return await generateWithAnthropic(apiKey, model, product, faqCount);
    } else {
      return await generateWithOpenAI(apiKey, model, product, faqCount);
    }
  } catch (error) {
    if (error.message?.includes("API key")) {
      throw new Error("Invalid API key. Please check your settings.");
    }
    if (error.message?.includes("quota") || error.message?.includes("rate")) {
      throw new Error("API rate limit or quota exceeded. Please try again later.");
    }
    throw error;
  }
}

/**
 * Validate an API key by making a lightweight test call
 */
export async function validateApiKey(apiKey, provider) {
  try {
    if (provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [{ role: "user", content: "Hi" }],
      });
    } else {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });
      await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      });
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

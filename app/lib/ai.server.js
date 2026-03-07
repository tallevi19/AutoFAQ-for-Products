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
Always respond with valid JSON only — no markdown, no code fences, no explanation.`;

  const userPrompt = `Based on the following product data, generate exactly ${faqCount} frequently asked questions with answers.

${context}

Return ONLY a JSON array in this exact format (no markdown, no code fences, no extra text):
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
 * Parse a JSON array of FAQs from AI response text.
 * Handles various formats: raw JSON, markdown code fences, wrapped objects.
 */
function parseFaqResponse(content) {
  if (!content || typeof content !== "string") {
    throw new Error("Empty response from AI provider");
  }

  const trimmed = content.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : trimmed;

  // Try parsing the cleaned content directly
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    // Handle wrapped formats like { "faqs": [...] } or { "questions": [...] }
    if (typeof parsed === "object" && parsed !== null) {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) return parsed[key];
      }
    }
  } catch {
    // Continue to regex extraction
  }

  // Try extracting a JSON array via regex as last resort
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to error
    }
  }

  throw new Error("Could not parse FAQ data from AI response. The AI may have returned an unexpected format.");
}

/**
 * Validate that parsed FAQs have the expected shape
 */
function validateFaqs(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) {
    throw new Error("AI returned an empty FAQ list");
  }
  return faqs.map((faq, i) => {
    if (!faq.question || !faq.answer) {
      throw new Error(`FAQ item ${i + 1} is missing a question or answer`);
    }
    return {
      question: String(faq.question).trim(),
      answer: String(faq.answer).trim(),
    };
  });
}

/**
 * Generate FAQs using OpenAI
 */
async function generateWithOpenAI(apiKey, model, product, faqCount) {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  const { systemPrompt, userPrompt } = buildPrompt(product, faqCount);

  const response = await client.chat.completions.create({
    model: model || "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response");
  }

  return parseFaqResponse(content);
}

/**
 * Generate FAQs using Anthropic
 */
async function generateWithAnthropic(apiKey, model, product, faqCount) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const { systemPrompt, userPrompt } = buildPrompt(product, faqCount);

  const response = await client.messages.create({
    model: model || "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content?.find((block) => block.type === "text");
  const content = textBlock?.text;
  if (!content) {
    throw new Error("Anthropic returned an empty response");
  }

  return parseFaqResponse(content);
}

/**
 * Main entry point for FAQ generation
 */
export async function generateFAQs({ apiKey, provider, model, product, faqCount = 5 }) {
  if (!apiKey) throw new Error("API key is required. Go to Settings to configure it.");
  if (!product) throw new Error("Product data is required");

  try {
    let faqs;
    if (provider === "anthropic") {
      faqs = await generateWithAnthropic(apiKey, model, product, faqCount);
    } else {
      faqs = await generateWithOpenAI(apiKey, model, product, faqCount);
    }
    return validateFaqs(faqs);
  } catch (error) {
    // Provide user-friendly error messages for common issues
    const msg = error.message || "";
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid x-api-key") || msg.includes("Incorrect API key")) {
      throw new Error("Invalid API key. Please check your API key in Settings.");
    }
    if (msg.includes("402") || msg.includes("Payment Required") || msg.includes("billing")) {
      throw new Error("Your AI provider account requires payment. Please check your billing at your provider's dashboard.");
    }
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate") || msg.includes("Rate limit")) {
      throw new Error("API rate limit or quota exceeded. Please wait a moment and try again.");
    }
    if (msg.includes("model") && (msg.includes("not found") || msg.includes("does not exist"))) {
      throw new Error(`The model "${model}" is not available. Please check your Settings and select a valid model.`);
    }
    if (msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      throw new Error("Could not connect to the AI provider. Please check your internet connection and try again.");
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
        model: "claude-haiku-4-5-20251001",
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
    const msg = error.message || "Unknown error";
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid x-api-key") || msg.includes("Incorrect API key")) {
      return { valid: false, error: "Invalid API key" };
    }
    if (msg.includes("402") || msg.includes("Payment Required")) {
      return { valid: false, error: "API key is valid but your account requires payment setup" };
    }
    return { valid: false, error: msg };
  }
}

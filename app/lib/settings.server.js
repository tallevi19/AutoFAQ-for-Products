/**
 * Shop settings helpers
 * Includes simple API key encryption at rest
 */

import prisma from "../db.server";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "shopify-ai-faq-default-key-32chr!";
const ALGORITHM = "aes-256-cbc";

function getKey() {
  return crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
}

export function encryptApiKey(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptApiKey(text) {
  try {
    const [ivHex, encryptedHex] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString();
  } catch {
    return text; // fallback for unencrypted keys
  }
}

export async function getShopSettings(shop) {
  const settings = await prisma.shopSettings.findUnique({
    where: { shop },
  });

  if (!settings) return null;

  return {
    ...settings,
    apiKey: settings.apiKey ? decryptApiKey(settings.apiKey) : "",
  };
}

export async function saveShopSettings(shop, data) {
  const payload = {
    shop,
    aiProvider: data.aiProvider || "openai",
    model: data.model || "gpt-4o",
    faqCount: parseInt(data.faqCount) || 5,
    autoGenerate: data.autoGenerate === true || data.autoGenerate === "true",
    ...(data.apiKey ? { apiKey: encryptApiKey(data.apiKey) } : {}),
  };

  return prisma.shopSettings.upsert({
    where: { shop },
    update: payload,
    create: payload,
  });
}

export const DEFAULT_MODELS = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o (Recommended)" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini (Faster & Cheaper)" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo (Budget)" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Recommended)" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Faster & Cheaper)" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus (Most Powerful)" },
  ],
};

// app/lib/models.js
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
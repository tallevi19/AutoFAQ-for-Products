export const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
};

export const AVAILABLE_MODELS = {
  openai: [
    { label: "GPT-4o Mini (Recommended)", value: "gpt-4o-mini" },
    { label: "GPT-4o", value: "gpt-4o" },
  ],
  anthropic: [
    { label: "Claude 3.5 Haiku (Recommended)", value: "claude-haiku-4-5" },
    { label: "Claude 3.5 Sonnet", value: "claude-sonnet-4-5" },
  ],
};
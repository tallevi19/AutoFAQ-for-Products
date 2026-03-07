export const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
};

export const AVAILABLE_MODELS = {
  openai: [
    { label: "GPT-4o Mini (Recommended)", value: "gpt-4o-mini" },
    { label: "GPT-4o", value: "gpt-4o" },
  ],
  anthropic: [
    { label: "Claude Haiku 4.5 (Recommended)", value: "claude-haiku-4-5-20251001" },
    { label: "Claude Sonnet 4.5", value: "claude-sonnet-4-5-20241022" },
  ],
};

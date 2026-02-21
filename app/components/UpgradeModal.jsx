import {
  Modal,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  Badge,
  Divider,
  Icon,
  ProgressBar,
} from "@shopify/polaris";
import { CheckIcon, LockIcon } from "@shopify/polaris-icons";
import { PLANS, PLAN_ORDER } from "../lib/plans.js";

/**
 * UpgradeModal
 *
 * Props:
 *   open         - boolean
 *   onClose      - fn
 *   reason       - string (why they hit the limit)
 *   limitKey     - "generationsPerMonth" | "products"
 *   currentPlan  - "free" | "starter" | "growth" | "pro"
 *   usage        - number (current usage)
 *   limit        - number (plan limit)
 */
export function UpgradeModal({
  open,
  onClose,
  reason,
  limitKey,
  currentPlan = "free",
  usage,
  limit,
}) {
  // Show the next 2 plans above the current one
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  const upgradePlans = PLAN_ORDER.slice(currentIndex + 1)
    .map((id) => PLANS[id])
    .filter(Boolean);

  const limitLabel =
    limitKey === "generationsPerMonth" ? "AI Generations" : "Products with FAQ";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upgrade Your Plan"
      secondaryActions={[{ content: "Maybe Later", onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Limit hit message */}
          <Box
            background="bg-surface-caution"
            padding="400"
            borderRadius="200"
          >
            <InlineStack gap="200" blockAlign="start" wrap={false}>
              <Icon source={LockIcon} tone="caution" />
              <BlockStack gap="100">
                <Text as="p" variant="bodyMd" fontWeight="semibold">
                  {reason}
                </Text>
                {limit && (
                  <Text as="p" variant="bodySm" tone="subdued">
                    {usage} / {limit} {limitLabel} used this month
                  </Text>
                )}
              </BlockStack>
            </InlineStack>
          </Box>

          <Text as="p" variant="bodyMd">
            Upgrade to continue — all paid plans include a{" "}
            <strong>7-day free trial</strong>.
          </Text>

          {/* Plan options */}
          <BlockStack gap="300">
            {upgradePlans.map((plan, i) => (
              <UpgradePlanOption
                key={plan.id}
                plan={plan}
                isRecommended={i === 0}
                onClose={onClose}
              />
            ))}
          </BlockStack>

          <Divider />

          <InlineStack align="center">
            <Button url="/app/billing" variant="plain" onClick={onClose}>
              View all plans & billing →
            </Button>
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function UpgradePlanOption({ plan, isRecommended, onClose }) {
  return (
    <Box
      background={isRecommended ? "bg-surface-active" : "bg-surface-secondary"}
      padding="400"
      borderRadius="200"
      borderWidth="025"
      borderColor={isRecommended ? "border-emphasis" : "border"}
    >
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h3" variant="headingSm">
              {plan.name}
            </Text>
            {isRecommended && <Badge tone="info">Recommended</Badge>}
            {plan.badge && !isRecommended && (
              <Badge tone="attention">{plan.badge}</Badge>
            )}
          </InlineStack>
          <Text as="p" variant="headingMd">
            ${plan.price}
            <Text as="span" variant="bodySm" tone="subdued">
              {" "}
              /mo
            </Text>
          </Text>
        </InlineStack>

        {/* Key features for this plan */}
        <InlineStack gap="300" wrap>
          {plan.features.slice(0, 3).map((f) => (
            <InlineStack key={f} gap="100" blockAlign="center">
              <Icon source={CheckIcon} tone="success" />
              <Text as="span" variant="bodySm">
                {f}
              </Text>
            </InlineStack>
          ))}
        </InlineStack>

        <Button
          variant={isRecommended ? "primary" : "secondary"}
          url={`/app/billing?upgrade=${plan.id}`}
          onClick={onClose}
          fullWidth
        >
          Upgrade to {plan.name} — 7-day free trial
        </Button>
      </BlockStack>
    </Box>
  );
}

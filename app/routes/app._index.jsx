import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Page, Card, Text, BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  return json({ shop: session.shop });
};

export default function Index() {
  const { shop } = useLoaderData();
  return (
    <Page title="AI FAQ Generator">
      <Card>
        <BlockStack gap="400">
          <Text as="h2" variant="headingMd">Welcome!</Text>
          <Text as="p">Connected to: {shop}</Text>
        </BlockStack>
      </Card>
    </Page>
  );
}

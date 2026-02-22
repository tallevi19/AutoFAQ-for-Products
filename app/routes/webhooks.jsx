import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  console.log(`Received webhook: ${topic} for ${shop}`);

  switch (topic) {
    case "APP_UNINSTALLED":
      // Clean up all shop data on uninstall
      await prisma.shopSettings.deleteMany({ where: { shop } });
      await prisma.productFAQ.deleteMany({ where: { shop } });
      break;

    case "PRODUCTS_UPDATE":
      // Optionally auto-regenerate FAQs on product update
      // (handled by autoGenerate setting)
      break;
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Log the request — legally you must acknowledge it
      // If you store personal data, delete it here
      console.log(`GDPR ${topic} for ${shop}`);
      break;
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }
  throw new Response();
};

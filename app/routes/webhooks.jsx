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

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};

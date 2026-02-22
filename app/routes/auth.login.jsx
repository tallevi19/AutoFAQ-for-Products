import { AppProvider } from "@shopify/shopify-app-remix/react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  const errors = {};
  if (request.method === "POST") {
    const data = await request.formData();
    const shop = data.get("shop");
    if (!shop) errors.shop = "Shop domain is required";
    else return login(request);
  }
  return json({ errors });
};

export default function Auth() {
  const { errors } = useLoaderData();
  return (
    <AppProvider isEmbeddedApp apiKey={process.env.SHOPIFY_API_KEY}>
      <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
        <h1>Install AI FAQ Generator</h1>
        <form method="post">
          <label>Shop domain</label>
          <input name="shop" type="text" placeholder="your-store.myshopify.com" />
          {errors?.shop && <p style={{ color: "red" }}>{errors.shop}</p>}
          <button type="submit">Install</button>
        </form>
      </div>
    </AppProvider>
  );
}
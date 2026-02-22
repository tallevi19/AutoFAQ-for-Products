import { redirect } from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { login } from "../shopify.server";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const shop = formData.get("shop");
  if (!shop) return { error: "Shop domain is required" };
  return login(request);
};

export default function Auth() {
  const actionData = useActionData();
  return (
    <div style={{ padding: "2rem", maxWidth: "400px", margin: "0 auto" }}>
      <h1>Install AI FAQ Generator</h1>
      <Form method="post">
        <label>Shop domain</label>
        <input name="shop" type="text" placeholder="your-store.myshopify.com" defaultValue="autofaq-for-products.myshopify.com" />
        {actionData?.error && <p style={{ color: "red" }}>{actionData.error}</p>}
        <button type="submit">Install</button>
      </Form>
    </div>
  );
}

import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError, useLocation } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const url = new URL(request.url);
  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    host: url.searchParams.get("host") || "",
  });
};

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

export default function App() {
  const { apiKey, host } = useLoaderData();
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey} host={host}>
      <NavMenu>
        <Link to="/app" rel="home">Home</Link>
        <Link to="/app/products">Products</Link>
        <Link to="/app/billing">Plans & Billing</Link>
        <Link to="/app/settings">Settings</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

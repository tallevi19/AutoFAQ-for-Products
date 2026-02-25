import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import { useEffect } from "react";

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
  const { apiKey, host: loaderHost } = useLoaderData();

  let host = loaderHost;
  if (typeof window !== "undefined") {
    if (loaderHost) {
      sessionStorage.setItem("shopify_host", loaderHost);
    } else {
      host = sessionStorage.getItem("shopify_host") || "";
    }
  }

  // Keep ?host= in the URL after client-side navigation so the App Bridge CDN
  // script can always re-read it for postMessage targetOrigin on token refresh.
  useEffect(() => {
    if (!host) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("host")) {
      url.searchParams.set("host", host);
      window.history.replaceState(null, "", url.toString());
    }
  }, [host]);

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

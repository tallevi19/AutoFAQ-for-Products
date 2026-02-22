import { redirect } from "@remix-run/node";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  
  if (shop && host) {
    return redirect(`/app?${url.searchParams.toString()}`);
  }
  return redirect("/app");
};

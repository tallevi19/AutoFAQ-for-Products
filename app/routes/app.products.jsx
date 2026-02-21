import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  Button,
  TextField,
  InlineStack,
  BlockStack,
  Thumbnail,
  EmptyState,
  Filters,
  ChoiceList,
  Pagination,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { fetchProducts } from "../lib/shopify.server";
import { getShopSettings } from "../lib/settings.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after") || null;
  const search = url.searchParams.get("search") || null;
  const faqFilter = url.searchParams.get("faq") || null;

  let query = null;
  if (search) query = `title:*${search}*`;
  if (faqFilter === "active") query = `${query ? query + " AND " : ""}status:active`;

  const { products, pageInfo } = await fetchProducts(admin.graphql, {
    first: 20,
    after,
    query,
  });

  const settings = await getShopSettings(session.shop);

  let filteredProducts = products;
  if (faqFilter === "has_faq") {
    filteredProducts = products.filter((p) => p.hasFaq);
  } else if (faqFilter === "no_faq") {
    filteredProducts = products.filter((p) => !p.hasFaq);
  }

  return json({
    products: filteredProducts,
    pageInfo,
    hasSettings: !!settings?.apiKey,
  });
};

export default function ProductsPage() {
  const { products, pageInfo, hasSettings } = useLoaderData();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");

  const handleSearchChange = useCallback((value) => {
    setSearchValue(value);
  }, []);

  const handleSearchSubmit = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (searchValue) {
      params.set("search", searchValue);
    } else {
      params.delete("search");
    }
    params.delete("after");
    setSearchParams(params);
  }, [searchValue, searchParams, setSearchParams]);

  const handleFaqFilter = useCallback(
    (value) => {
      const params = new URLSearchParams(searchParams);
      if (value && value.length > 0) {
        params.set("faq", value[0]);
      } else {
        params.delete("faq");
      }
      params.delete("after");
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  const filters = [
    {
      key: "faq",
      label: "FAQ Status",
      filter: (
        <ChoiceList
          title="FAQ Status"
          titleHidden
          choices={[
            { label: "Has FAQ", value: "has_faq" },
            { label: "No FAQ", value: "no_faq" },
          ]}
          selected={searchParams.get("faq") ? [searchParams.get("faq")] : []}
          onChange={handleFaqFilter}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [];
  if (searchParams.get("faq")) {
    appliedFilters.push({
      key: "faq",
      label: `FAQ: ${searchParams.get("faq") === "has_faq" ? "Has FAQ" : "No FAQ"}`,
      onRemove: () => handleFaqFilter([]),
    });
  }

  const rowMarkup = products.map((product, index) => {
    const productNumericId = product.id.split("/").pop();
    return (
      <IndexTable.Row id={product.id} key={product.id} position={index}>
        <IndexTable.Cell>
          <InlineStack gap="300" align="start" blockAlign="center">
            <Thumbnail
              source={product.featuredImage?.url || ""}
              alt={product.featuredImage?.altText || product.title}
              size="small"
            />
            <BlockStack gap="100">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {product.title}
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {product.priceRangeV2?.minVariantPrice
                  ? `From ${product.priceRangeV2.minVariantPrice.currencyCode} ${product.priceRangeV2.minVariantPrice.amount}`
                  : ""}
              </Text>
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={product.hasFaq ? "success" : "new"}>
            {product.hasFaq ? `${product.faqCount} FAQs` : "No FAQ"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{product.status}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button
              size="slim"
              onClick={() => navigate(`/app/products/${productNumericId}`)}
            >
              {product.hasFaq ? "Manage FAQ" : "Generate FAQ"}
            </Button>
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Products"
      subtitle="Select a product to generate or manage its AI FAQ section"
      backAction={{ content: "Home", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Filters
              queryValue={searchValue}
              queryPlaceholder="Search products..."
              filters={filters}
              appliedFilters={appliedFilters}
              onQueryChange={handleSearchChange}
              onQueryClear={() => {
                setSearchValue("");
                const params = new URLSearchParams(searchParams);
                params.delete("search");
                setSearchParams(params);
              }}
              onClearAll={() => {
                setSearchValue("");
                setSearchParams({});
              }}
            >
              <Button onClick={handleSearchSubmit}>Search</Button>
            </Filters>
            {products.length === 0 ? (
              <EmptyState
                heading="No products found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Try adjusting your search or filter criteria.</p>
              </EmptyState>
            ) : (
              <IndexTable
                resourceName={{ singular: "product", plural: "products" }}
                itemCount={products.length}
                headings={[
                  { title: "Product" },
                  { title: "FAQ Status" },
                  { title: "Status" },
                  { title: "Actions" },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            )}
          </Card>
          {(pageInfo?.hasNextPage) && (
            <Pagination
              hasPrevious={false}
              hasNext={pageInfo.hasNextPage}
              onNext={() => {
                const params = new URLSearchParams(searchParams);
                params.set("after", pageInfo.endCursor);
                setSearchParams(params);
              }}
            />
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

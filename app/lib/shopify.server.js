/**
 * Shopify GraphQL helpers
 */

const PRODUCT_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      description
      descriptionHtml
      productType
      vendor
      tags
      status
      options {
        name
        values
      }
      variants(first: 50) {
        edges {
          node {
            id
            title
            price
            sku
            selectedOptions {
              name
              value
            }
          }
        }
      }
      metafields(first: 30) {
        edges {
          node {
            namespace
            key
            value
            type
          }
        }
      }
    }
  }
`;

const PRODUCTS_LIST_QUERY = `
  query GetProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          status
          featuredImage {
            url
            altText
          }
          priceRangeV2 {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          metafield(namespace: "ai_faq", key: "faqs") {
            value
          }
        }
      }
    }
  }
`;

const SET_METAFIELD_MUTATION = `
  mutation SetProductMetafield($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_METAFIELD_MUTATION = `
  mutation DeleteMetafield($input: MetafieldDeleteInput!) {
    metafieldDelete(input: $input) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Fetch full product data from Shopify
 */
export async function fetchProduct(graphql, productId) {
  const response = await graphql(PRODUCT_QUERY, {
    variables: { id: productId },
  });

  const { data } = await response.json();
  const product = data?.product;
  if (!product) return null;

  // Normalize variants
  const variants = product.variants.edges.map(({ node }) => node);

  // Normalize metafields
  const metafields = product.metafields.edges
    .map(({ node }) => node)
    .filter((mf) => mf.namespace !== "ai_faq"); // Exclude our own metafields

  return {
    ...product,
    variants,
    metafields,
  };
}

/**
 * Fetch paginated product list
 */
export async function fetchProducts(graphql, { first = 20, after = null, query = null } = {}) {
  const response = await graphql(PRODUCTS_LIST_QUERY, {
    variables: { first, after, query },
  });

  const { data } = await response.json();
  const connection = data?.products;

  return {
    products: connection.edges.map(({ node }) => ({
      ...node,
      hasFaq: !!node.metafield?.value,
      faqCount: node.metafield?.value
        ? JSON.parse(node.metafield.value).length
        : 0,
    })),
    pageInfo: connection.pageInfo,
  };
}

/**
 * Save FAQs to product metafield
 */
export async function saveFaqsToMetafield(graphql, productId, faqs) {
  const response = await graphql(SET_METAFIELD_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: productId,
          namespace: "ai_faq",
          key: "faqs",
          value: JSON.stringify(faqs),
          type: "json",
        },
      ],
    },
  });

  const { data } = await response.json();
  const errors = data?.metafieldsSet?.userErrors;

  if (errors && errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  return data?.metafieldsSet?.metafields?.[0];
}

/**
 * Get FAQs from product metafield
 */
export async function getFaqsFromMetafield(graphql, productId) {
  const GET_FAQ_QUERY = `
    query GetFAQ($id: ID!) {
      product(id: $id) {
        metafield(namespace: "ai_faq", key: "faqs") {
          id
          value
        }
      }
    }
  `;

  const response = await graphql(GET_FAQ_QUERY, {
    variables: { id: productId },
  });

  const { data } = await response.json();
  const metafield = data?.product?.metafield;

  if (!metafield?.value) return { faqs: [], metafieldId: null };

  return {
    faqs: JSON.parse(metafield.value),
    metafieldId: metafield.id,
  };
}

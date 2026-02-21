# 🤖 Shopify AI FAQ Generator

A public Shopify app that automatically generates AI-powered FAQ sections for product pages using OpenAI or Anthropic.

## Features

- **One-click FAQ generation** — AI reads all product data (title, description, variants, metafields, options, tags) and generates relevant Q&As
- **Dual AI provider support** — Works with OpenAI (GPT-4o, GPT-4o Mini) and Anthropic (Claude 3.5 Sonnet, Haiku)
- **Merchant brings their own API key** — Stored encrypted in the database
- **Storefront Theme App Extension** — FAQ section renders natively on product pages via a Liquid block
- **Full edit control** — Merchants can edit, add, or delete individual FAQ items before publishing
- **Customizable UI** — Colors, fonts, heading, and badge options from the Theme Editor
- **Metafield storage** — FAQs stored directly in Shopify product metafields (no external database dependency for storefront)
- **Bulk management** — Browse all products with FAQ status from one dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Remix + Vite |
| Shopify integration | `@shopify/shopify-app-remix` |
| Admin UI | Shopify Polaris |
| App Bridge | `@shopify/app-bridge-react` |
| AI (OpenAI) | `openai` SDK |
| AI (Anthropic) | `@anthropic-ai/sdk` |
| Database | Prisma + SQLite (dev) / PostgreSQL (prod) |
| Storefront | Theme App Extension (Liquid + CSS + JS) |

---

## Setup & Installation

### 1. Prerequisites

- Node.js 18+
- A [Shopify Partner account](https://partners.shopify.com)
- A development store
- Shopify CLI: `npm install -g @shopify/cli`

### 2. Clone & Install

```bash
git clone <your-repo>
cd shopify-ai-faq
npm install
```

### 3. Create your app in Partner Dashboard

1. Go to [partners.shopify.com](https://partners.shopify.com)
2. Click **Apps → Create app**
3. Choose **Create app manually**
4. Copy your **API key** and **API secret**

### 4. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_here
SHOPIFY_APP_URL=https://your-ngrok-or-deployed-url.com
DATABASE_URL=file:./dev.db
ENCRYPTION_KEY=generate-a-random-32-char-string-here
```

### 5. Set up the database

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 6. Run the app

```bash
npm run dev
```

This will:
- Start the Remix server
- Start the Shopify CLI tunnel
- Open the app in your dev store

---

## Deploying to Production

### Option A: Railway (Recommended)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app) → New Project → GitHub repo
3. Add a PostgreSQL database plugin
4. Set environment variables (update `DATABASE_URL` to the Railway Postgres URL)
5. Set build command: `npm run setup && npm run build`
6. Set start command: `npm run start`
7. Update `SHOPIFY_APP_URL` and Partner Dashboard URLs with Railway URL

### Option B: Fly.io

```bash
fly launch
fly secrets set SHOPIFY_API_KEY=... SHOPIFY_API_SECRET=... ENCRYPTION_KEY=...
fly deploy
```

### Option C: Heroku

```bash
heroku create your-app-name
heroku addons:create heroku-postgresql
heroku config:set SHOPIFY_API_KEY=... SHOPIFY_API_SECRET=... ENCRYPTION_KEY=...
git push heroku main
heroku run npx prisma migrate deploy
```

---

## Installing the Theme Extension

After deploying, install the Theme App Extension on a storefront:

1. In the Shopify admin, go to **Online Store → Themes**
2. Click **Customize** on your active theme
3. Navigate to a product page template
4. Click **Add block** → look for **AI FAQ Section**
5. Place it wherever you want on the product page
6. Customize colors and settings in the panel
7. Click **Save**

---

## Publishing to the Shopify App Store

1. Complete the app in your Partner Dashboard
2. Fill in the **App listing** (name, description, screenshots, pricing)
3. Submit for review
4. Shopify will review within ~5 business days

---

## Project Structure

```
shopify-ai-faq/
├── app/
│   ├── routes/
│   │   ├── app.jsx                    # Layout with nav
│   │   ├── app._index.jsx             # Dashboard
│   │   ├── app.products.jsx           # Product list
│   │   ├── app.products.$productId.jsx # FAQ editor
│   │   ├── app.settings.jsx           # API key & preferences
│   │   ├── auth.$.jsx                 # Shopify OAuth
│   │   └── webhooks.jsx               # Webhook handlers
│   ├── lib/
│   │   ├── ai.server.js               # OpenAI + Anthropic integration
│   │   ├── shopify.server.js          # GraphQL helpers
│   │   └── settings.server.js         # Settings & encryption
│   ├── shopify.server.js              # Shopify app config
│   ├── db.server.js                   # Prisma client
│   └── root.jsx                       # HTML root
├── extensions/
│   └── ai-faq-extension/
│       ├── blocks/
│       │   └── ai-faq.liquid          # Storefront FAQ block
│       ├── assets/
│       │   ├── ai-faq.css             # Styles
│       │   └── ai-faq.js              # Accordion JS
│       └── shopify.extension.toml
├── prisma/
│   └── schema.prisma
├── shopify.app.toml
├── vite.config.js
└── .env.example
```

---

## How FAQs Are Stored

FAQs are stored as a **JSON metafield** on each product:
- Namespace: `ai_faq`
- Key: `faqs`
- Type: `json`

This means:
- No external database calls when rendering on the storefront
- FAQs are portable and can be accessed via the Storefront API
- Easy to export/import with product data

---

## License

MIT

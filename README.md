# Label Less – Overblik

Automated marketing & revenue dashboard that replaces the manual monthly Google
Sheet. It pulls **revenue + COGS from Shopify** and **ad spend from Google Ads
and Meta**, twice a month, computes the same figures the sheet showed, and adds
**year-over-year (YoY)** and **month-over-month (MoM)** graphs.

## The model

Each month has two snapshots: a **half month** (1st–15th) and a **full month**
(whole month). Only three numbers are fetched — everything else is arithmetic
(all in DKK, VAT 25%):

| Field | Source / formula |
|---|---|
| Omsætning (revenue incl. VAT) | Shopify total sales |
| DB (dækningsbidrag) | `Omsætning/1.25 − COGS` |
| Spend | Google Ads cost + Meta spend |
| Contribution margin | `DB − Spend` |
| DB % | `DB ÷ (Omsætning/1.25)` |
| MER | `Omsætning ÷ Spend` |
| MPR | `DB ÷ Spend` |
| Note | manual, editable in the UI |

Formulas live in [`src/lib/metrics.ts`](src/lib/metrics.ts) and are locked to the
sheet by the calibration test in [`src/lib/metrics.test.ts`](src/lib/metrics.test.ts).

## Architecture

- **Next.js 16 (App Router) + React 19 + Tailwind v4**, deployed on Vercel.
- **Recharts** for the YoY/MoM graphs.
- **Storage**: Postgres (Neon) in production via `DATABASE_URL`; a local JSON file
  (`.data/db.json`) when that's unset. See [`src/lib/store`](src/lib/store).
- **Integrations** behind one interface ([`src/lib/integrations`](src/lib/integrations));
  each falls back to deterministic **mock data** until its credentials exist, so
  the whole app is usable immediately.
- **Auth**: one shared password → HMAC-signed cookie, enforced by
  [`src/proxy.ts`](src/proxy.ts) (Next 16's renamed middleware).
- **Automation**: a daily Vercel Cron hits `/api/cron`; it acts only on the 16th
  (half month) and the 1st (previous full month). See [`vercel.json`](vercel.json).

## Local development

```bash
npm install
npm run dev          # http://localhost:3000  (password: "labelless", mock data)
```

`.env.local` ships with `USE_MOCK_DATA=true`. Useful commands:

```bash
npm test             # unit tests incl. sheet calibration
npm run typecheck
npm run lint
npm run build
```

Load data locally from the dashboard's **Data-hentning** panel ("Backfill
historik" / "Kør dagens pull"), or via the API:

```bash
curl -X POST localhost:3000/api/ingest -H 'Content-Type: application/json' \
  -d '{"action":"backfill","from":{"year":2024,"month":1,"split":"half"},"to":{"year":2026,"month":7,"split":"full"}}'
```

## Deployment (Vercel)

1. Push to a Git repo and import it into Vercel.
2. Add a **Neon** Postgres database (Vercel → Storage) → sets `DATABASE_URL`.
3. Set env vars (see `.env.example`): `APP_PASSWORD`, `AUTH_SECRET`,
   `CRON_SECRET`, and each source's credentials. Leave `USE_MOCK_DATA` unset/false.
4. Deploy. The cron in `vercel.json` runs daily at 05:00 UTC.
5. Run one **Backfill historik** to populate history.

Set `AUTH_SECRET` and `CRON_SECRET` with `openssl rand -hex 32`.

## Connecting the real data sources

Until a source has credentials it stays on mock data (an amber banner lists
which). Add them one at a time; each switches to live automatically.

### Shopify
1. Shopify admin → **Settings → Apps and sales channels → Develop apps → Create an app**.
2. **Configure Admin API scopes**: `read_orders`, `read_products`, `read_inventory`.
3. **Install app**, then copy the **Admin API access token**.
4. Set `SHOPIFY_STORE_DOMAIN` (e.g. `labelless.myshopify.com`) and `SHOPIFY_ADMIN_TOKEN`.
5. Ensure **cost per item** is set on products so COGS is accurate.

### Google Ads (longest lead time — start first)
1. Apply for a **developer token** (Google Ads → Tools → API Center). Basic access
   approval can take a few days.
2. Create an **OAuth client** (Google Cloud Console) and generate a **refresh token**
   for an account with access to the ad account.
3. Set `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`,
   `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`,
   `GOOGLE_ADS_CUSTOMER_ID` (digits only), and `GOOGLE_ADS_LOGIN_CUSTOMER_ID` if
   using a manager account.

### Meta (Facebook/Instagram)
1. Create an app at developers.facebook.com with the **Marketing API**.
2. Create a **System User** with `ads_read` and generate a **long-lived token**.
3. Set `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID` (e.g. `act_1234567890`).

## Calibration

The revenue/COGS/spend definitions are provisional until checked against the
sheet's real numbers. After connecting a live source, compare its output for a
known period (e.g. June 2024) to the sheet; if it differs, adjust the field
selection in the relevant adapter under [`src/lib/integrations`](src/lib/integrations).
The mock June figures are the sheet's actual values, so the app already shows the
target numbers to calibrate toward.

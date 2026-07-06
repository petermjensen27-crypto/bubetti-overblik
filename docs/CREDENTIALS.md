# Getting API credentials

Fill these into `.env.local` (local dev) and into Vercel → Project → Settings →
Environment Variables (production). Each source switches from mock to live
automatically once its variables are present. Add them one at a time.

Order of attack: **start Google Ads first** (approval can take days), do Shopify
and Meta while you wait.

---

## 1. Shopify  →  revenue + COGS

1. Shopify admin → **Settings** → **Apps and sales channels** → **Develop apps**.
   (If disabled: **Allow custom app development** → confirm.)
2. **Create an app** → name it e.g. "Overblik".
3. **Configuration** → **Admin API integration** → **Configure** → enable scopes:
   - `read_orders`
   - `read_products`
   - `read_inventory`
   - `read_all_orders`  ← **important:** without this Shopify only returns the
     last 60 days of orders, so backfilling 2024–2025 would fail. It's a
     checkbox in the same scope list; Shopify may ask you to confirm the reason.
4. **Save** → **Install app**.
5. **API credentials** tab → reveal the **Admin API access token** (starts with
   `shpat_`). You can only view it once — copy it now.

Set:
```
SHOPIFY_STORE_DOMAIN=labelless.myshopify.com   # your .myshopify.com domain
SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxx
```
Also make sure **Cost per item** is set on your products (Products → variant →
Cost per item) so COGS is accurate.

---

## 2. Google Ads  →  ad spend  (do this first — slowest)

You need four things: a **developer token**, an **OAuth client** (id + secret), a
**refresh token**, and the **customer ID**.

### a) Developer token
1. Sign in to your **Google Ads manager (MCC) account**. If you don't have one,
   create a manager account (free) and link your ad account to it.
2. **Tools & Settings** (wrench) → **Setup** → **API Center**.
3. Accept terms and copy the **Developer token**.
4. Apply for **Basic access** (the API Center page has the form). A brand-new
   token is "Test access" and only works on test accounts — Basic access is
   required for real data and takes ~1–3 business days to approve.

### b) OAuth client (Google Cloud)
1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services** → **Library** → enable **Google Ads API**.
3. **APIs & Services** → **OAuth consent screen** → External → add your own email
   under **Test users**.
4. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**
   → Application type **Web application**.
5. Under **Authorized redirect URIs** add:
   `https://developers.google.com/oauthplayground`
6. Save and copy the **Client ID** and **Client secret**.

### c) Refresh token (via OAuth Playground)
1. Open [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Click the **gear icon** (top right) → check **Use your own OAuth credentials**
   → paste your Client ID and Client secret.
3. In the left "Step 1" box, in the **Input your own scopes** field, enter:
   `https://www.googleapis.com/auth/adwords` → **Authorize APIs** → sign in and allow.
4. **Step 2** → **Exchange authorization code for tokens** → copy the **Refresh token**.

### d) Customer ID
- Your Google Ads account ID, top-right, digits only (drop the dashes:
  `123-456-7890` → `1234567890`).
- If the ad account sits under a manager account, also set the manager's ID as
  the login customer ID.

Set:
```
GOOGLE_ADS_DEVELOPER_TOKEN=xxxxxxxx
GOOGLE_ADS_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=xxxxxxxx
GOOGLE_ADS_REFRESH_TOKEN=1//xxxxxxxx
GOOGLE_ADS_CUSTOMER_ID=1234567890
GOOGLE_ADS_LOGIN_CUSTOMER_ID=0987654321   # manager account id, or omit
```

---

## 3. Meta (Facebook/Instagram)  →  ad spend

Use a **System User** token so it doesn't expire with a personal login.

1. [Meta for Developers](https://developers.facebook.com/) → **My Apps** →
   **Create App** → type **Business** → create.
2. In the app, add the **Marketing API** product (Add product → Marketing API).
3. Go to **Business Settings** (business.facebook.com/settings) →
   **Users** → **System users** → **Add** → create an **Admin** system user.
4. **Add assets** → assign your **Ad account** with **Manage** (full) access.
5. Select the system user → **Generate new token** → pick your app → check
   permissions **`ads_read`** and **`read_insights`** → generate.
6. Copy the token (long-lived — set a 60-day or "never" expiry if offered).
7. **Ad account ID**: Ads Manager → the account dropdown shows a numeric ID;
   prefix it with `act_`.

Set:
```
META_ACCESS_TOKEN=EAAxxxxxxxx
META_AD_ACCOUNT_ID=act_1234567890
```

---

## After adding credentials

1. Restart dev (`npm run dev`) or redeploy on Vercel so env vars load.
2. The amber "mock data" banner should drop the source you just connected.
3. Click **Backfill historik** (or hit `/api/ingest`) to pull real history.
4. **Calibrate:** compare a known month (e.g. June 2024) to the sheet. If numbers
   differ, adjust the field selection in the matching adapter under
   `src/lib/integrations/` — see the notes at the top of each file.

### Quick per-source smoke test
You can confirm one source in isolation by temporarily setting `USE_MOCK_DATA`
unset and pulling a single recent period from the dashboard, then checking the
ingestion result / `.data/db.json` (dev) or the dashboard values.

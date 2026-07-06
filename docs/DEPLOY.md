# Deploying to Vercel

The app is production-ready. Deployment needs your own Vercel + database
accounts, so these are the exact steps. Two paths — the GitHub path is
recommended (auto-deploys on every push, and Vercel Cron works out of the box).

## Prerequisites (once)
- A **Vercel** account (vercel.com).
- A **Neon** Postgres database — free tier is fine. In production the app must
  use Postgres (Vercel's filesystem is ephemeral, so the local JSON store won't
  persist). Vercel → Storage → Neon creates one and sets `DATABASE_URL` for you.

## Path A — GitHub + Vercel dashboard (recommended)
1. Create a GitHub repo and push this project:
   ```bash
   git remote add origin git@github.com:<you>/bubetti-overblik.git
   git push -u origin main
   ```
2. Vercel → **Add New → Project** → import the repo. Framework auto-detects Next.js.
3. Vercel → **Storage → Create → Neon** → attach to the project (sets `DATABASE_URL`).
4. Vercel → **Settings → Environment Variables** → add (see `.env.example`):
   - `APP_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`
   - `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_TOKEN`
   - `GOOGLE_ADS_*` (developer token, client id/secret, refresh token, customer id, login customer id)
   - `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`
   - Do **not** set `USE_MOCK_DATA` (leave unset → live data).
   Generate secrets: `openssl rand -hex 32`.
5. **Deploy**. The cron in `vercel.json` runs daily at 05:00 UTC; the app acts
   on the 16th (half month) and the 1st (previous full month).
6. First run only: open the app → **Data-hentning → Backfill historik** to load
   all history into the new database (local data doesn't transfer).

## Path B — Vercel CLI
```bash
npm i -g vercel
vercel login
vercel link
# add each env var (repeat for production):
vercel env add APP_PASSWORD production
# … repeat for every variable above …
vercel --prod
```
Still add a Neon database via the Vercel dashboard (Storage) so `DATABASE_URL` is set.

## After deploy — checklist
- Log in with `APP_PASSWORD`.
- Run **Backfill historik** once (populates Neon; ~1–2 min).
- Confirm the budget panel and forecast render.
- Optional: trigger the cron manually to verify — `GET /api/cron` with header
  `Authorization: Bearer <CRON_SECRET>`.

## Notes
- **Tokens expire**: the Meta system-user token and Google refresh token can
  eventually expire; if a source goes stale, regenerate and update the env var.
- **API versions**: Shopify/Google/Meta retire versions periodically. If a pull
  starts 404-ing, bump `SHOPIFY_API_VERSION` / `GOOGLE_ADS_API_VERSION` /
  `META_API_VERSION`.
- **Budget**: editable via `PUT /api/budget`; next year's budget is added the
  same way (defaults live in `src/lib/budget.ts`).

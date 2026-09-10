# XTZYYY Premium API — Cloudflare Workers

Project ini mempertahankan frontend statis yang ada dan menambahkan Cloudflare Worker sebagai API runtime.

## Deploy

1. Install dependencies:

```bash
npm install
```

2. Login Cloudflare:

```bash
npx wrangler login
```

3. Set secret API key:

```bash
npx wrangler secret put API_KEY
```

4. Optional upstream secrets:

```bash
npx wrangler secret put EXTERNAL_API_KEY
npx wrangler secret put EXTERNAL_API_URL
npx wrangler secret put CAPCUT_CREATE_URL
npx wrangler secret put CAPCUT_VERIFY_URL
npx wrangler secret put ALIGHT_PREM_URL
```

5. Test locally:

```bash
cp .dev.vars.example .dev.vars
npx wrangler dev
```

6. Deploy:

```bash
npx wrangler deploy
```

## Routes

- `/` — landing page
- `/features` — features
- `/plans` — Buy Plan API
- `/dashboard` — dashboard
- `/docs` — interactive API docs
- `/status` — global status
- `GET /api/v1/plans` — plan catalog
- `POST /api/v1/plans/buy` — create activation order
- `GET /api/v1/status/global` — global status
- `GET /api/v1/docs` — endpoint documentation
- `GET /health` — health check

## Important

`POST /api/v1/plans/buy` creates an activation order only. It does not charge a card or process real money. A legitimate payment gateway can be integrated later using its official API/webhook flow.

Never commit `.env`, `.dev.vars`, API keys, payment secrets, or provider credentials.

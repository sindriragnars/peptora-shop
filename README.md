# peptora-shop

Multi-tenant storefront platform. Each tenant runs at its own subdomain (`<slug>.peptora.app`) and connects own Revolut Business as merchant of record.

## Stack

- SvelteKit 2 + Svelte 5 (runes)
- Tailwind v4
- Vercel (adapter-vercel SSR — tenant resolution reads Host header)
- Decap CMS for product editing (added in Phase 1)
- IndexedDB cart (added in Phase 2)
- Revolut Merchant API hosted checkout (added in Phase 3)
- Upstash Redis for order log (added in Phase 3)
- Resend for transactional email (added in Phase 4)
- Capacitor for per-tenant Android `.apk` distribution (added in Phase 5)

## Phase 0 — what's here now

- Tenant model + resolver (subdomain in prod, path-based fallback in dev)
- One demo tenant at `content/tenants/demo/`
- Platform landing page lists active tenants
- Per-tenant storefront under `/<slug>` with tenant-branded layout
- Per-tenant theme injection via CSS variables — no class rewriting

## Local dev

```
npm install
npm run dev
```

Visit:
- `http://localhost:5173/` — platform landing page
- `http://localhost:5173/demo` — demo tenant storefront (path-based fallback)

In production, the demo tenant would be reached at `demo.peptora.app`.

## Adding a tenant

1. Create `content/tenants/<slug>/tenant.json` (copy `demo/tenant.json` as template)
2. Generate Revolut Business API key + webhook secret for the client
3. Add `<SLUG>_REVOLUT_API_KEY` and `<SLUG>_REVOLUT_WEBHOOK_SECRET` to Vercel env
4. Add `<slug>.peptora.app` as alias in Vercel Domains
5. Restart dev / redeploy

Phase 6 will replace step 1 with a CLI script.

## Design decision

Full architecture rationale: `Decisions/E-commerce architecture.md` in the Obsidian vault.

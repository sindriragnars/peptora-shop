# peptora-shop

Multi-tenant e-commerce platform for the Peptora ecosystem. Serves a full
WebApp + storefront per merchant under `<slug>.peptora.app` from a single
SvelteKit codebase. Each tenant gets the full Peptora reference + tooling
(peptides, calculator, stacks, doses, news) PLUS their own shop.

## Stack

- **SvelteKit 2.57** + Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`)
- **Tailwind CSS 4** via `@theme` CSS variables (per-tenant brand color override)
- **adapter-vercel** SSR — multi-tenant, NOT prerendered
- **Dexie 4** IndexedDB (cart, reminders, dose logs — per-origin so each subdomain is isolated)
- **Stripe** Checkout (env var `PAYMENT_PROVIDER` switches between providers)
- **Upstash Redis** (orders, signups, tenants — reuses peptora-push instance)
- **Capacitor 8** per-tenant Android APK (`scripts/build-apk.mjs <slug>`)

## How tenancy works

`src/hooks.ts` (reroute) rewrites `<slug>.peptora.app/<path>` → `/<slug>/<path>`
so SvelteKit matches the `src/routes/[slug]/...` tree. Browser URL stays clean.

`src/hooks.server.ts` resolves `locals.tenant` from the subdomain hostname
and gates `/admin/*` with Basic Auth (`<SLUG_UPPER>_ADMIN_PASSWORD` env var
per tenant, `PLATFORM_ADMIN_PASSWORD` for `/admin/signups`).

## Tenants live in markdown

- `content/tenants/<slug>/tenant.json` — name, theme, contact, shipping, env-var refs
- `content/tenants/<slug>/products/*.md` — frontmatter + body (gray-matter + marked)
- `content/tenants/<slug>/news/*.md` — same shape, separate collection

Per-tenant images: `static/tenants/<slug>/images/*` (committed by `/admin/images`
upload endpoint via GitHub Contents API — see `src/lib/github-content.ts`).

## Key files for orientation

- `src/routes/[slug]/+layout.{server,svelte}.ts` — tenant resolution, bottom nav, brand vars
- `src/routes/[slug]/admin/+layout.svelte` — admin shell (Yfirlit / Vörur / Fréttir / Pantanir)
- `src/routes/[slug]/admin/+page.{server,svelte}.ts` — dashboard (revenue + recent orders + low stock)
- `src/lib/tenants.ts` — `resolveTenantSlug()`, central registry
- `src/lib/admin-auth.ts` — Basic Auth check used by hooks.server.ts
- `src/lib/orders.ts` — Order schema + Redis CRUD
- `src/lib/products.server.ts` + `news.server.ts` — build-time eager-glob loaders
- `src/lib/github-content.ts` — admin-side live GitHub writes (PAT-backed)
- `scripts/build-apk.mjs` — per-tenant APK builder (`--standalone` for the generic Peptora APK)

## Conventions

- **Commits**: imperative, why-not-what, no scope prefixes. Heredoc for multi-line messages.
- **Pushes to main require explicit user permission** — auto-mode classifier blocks unattended pushes.
- **No emoji** in code, comments, or commits unless explicitly requested.
- **Comments**: leading WHY, never restate what the next line obviously does.
- **Heap**: `npm run build` sets `--max-old-space-size=8192` because adapter-vercel server bundle outgrew default.

## Deploys

- Push to `main` → Vercel auto-deploys (~30-60 s)
- Per-tenant env vars set in Vercel dashboard, not in code
- Local `npm run build` may hit `@vercel/nft` Windows quirk (`EBUSY: ...C:\swapfile.sys`).
  Vite compile is what matters; the NFT step is harmless to skip and runs cleanly on Vercel CI.

## Sister repos

- **peptora-webapp** — standalone Peptora at `app.peptora.app` (canonical doses/calculator/i18n source; mirror changes here)
- **peptora-web** — Astro marketing site at `peptora.app`
- **peptora-push** — VAPID push backend that schedules reminder notifications via QStash

## Gotchas

- Reroute skips `/api/`, `/manifest.webmanifest`, and `/pwa-icon-*.png` paths — those
  read `locals.tenant` directly without a slug prefix.
- Decap CMS lives at `/cms`, not `/admin` (admin is the new SvelteKit dashboard).
- After Capacitor regen for a tenant build, `android/app/src/main/res/*` shows
  modified splash/icon PNGs — those are generated, leave them unstaged.

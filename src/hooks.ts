import type { Reroute } from '@sveltejs/kit';

/**
 * Universal reroute hook (runs both server + client). When a request
 * lands on `<slug>.peptora.app/<path>`, rewrite the routing path to
 * `/<slug>/<path>` so SvelteKit's router matches the `[slug]/...`
 * routes. The browser still shows the original URL.
 *
 * URL mutation in `hooks.server.ts` doesn't work for routing — only
 * the `reroute` hook is consulted by the SvelteKit router. The admin
 * gate in `hooks.server.ts` still detects subdomain admin requests
 * by checking the un-rewritten pathname directly.
 */

const RESERVED_SUBDOMAINS = new Set([
	'www',
	'app',
	'shop',
	'peptora-push',
	'peptora-cms-oauth',
	'admin'
]);

export const reroute: Reroute = ({ url }) => {
	if (!url.hostname.endsWith('.peptora.app')) return;
	const sub = url.hostname.slice(0, -'.peptora.app'.length);
	if (!sub || RESERVED_SUBDOMAINS.has(sub)) return;

	// API endpoints stay at /api/* regardless of subdomain. The webhook
	// + checkout handlers read the tenant slug from URL params (or
	// resolve via locals.tenant) and don't need a slug prefix on the
	// path — prefixing would 404 because routes/[slug]/api/ doesn't exist.
	if (url.pathname.startsWith('/api/')) return;

	// PWA endpoints (manifest + icon) live at the platform root. They
	// read locals.tenant (populated by hooks.server.ts from the subdomain
	// host) to serve per-tenant content. Prefixing with /<slug>/ would
	// 404 since there's no route at [slug]/manifest.webmanifest.
	if (
		url.pathname === '/manifest.webmanifest' ||
		/^\/pwa-icon-\d+\.png$/.test(url.pathname)
	) {
		return;
	}

	const expectedPrefix = `/${sub}`;
	if (url.pathname === expectedPrefix || url.pathname.startsWith(`${expectedPrefix}/`)) {
		// Already prefixed (e.g. visitor typed demo.peptora.app/demo/...).
		// Don't double up.
		return;
	}
	return `${expectedPrefix}${url.pathname}`;
};

/**
 * Tenant config loader.
 *
 * Each tenant lives at `content/tenants/<slug>/tenant.json`. We import them
 * eagerly via Vite's `import.meta.glob` so SvelteKit can prerender + edge-
 * render without filesystem reads at runtime — content is bundled at build
 * time exactly like a static asset.
 *
 * To add a tenant, create the JSON file + restart dev / redeploy. Phase 6
 * will add a tenant-onboarding script.
 */

/** Strict tenant config schema. Mirrored in Decap CMS config later. */
export interface TenantConfig {
	slug: string;
	name: string;
	tagline: string;
	logo: string | null;
	theme: {
		brand: string;
		accent: string;
	};
	contact: {
		email: string;
		phone: string;
		address: string;
		vskNumber?: string;
	};
	shipping: {
		flatRateISK: number;
		freeAboveISK: number;
		options: string[];
	};
	revolut: {
		apiKeyRef: string;
		webhookSecretRef: string;
		merchantId?: string;
	};
	active: boolean;
}

// Eager-glob all tenant.json files. The pattern is anchored so we can rely
// on the directory name being the slug.
const tenantModules = import.meta.glob<{ default: TenantConfig }>(
	'/content/tenants/*/tenant.json',
	{ eager: true }
);

const tenantMap: Record<string, TenantConfig> = {};
for (const [path, mod] of Object.entries(tenantModules)) {
	const match = path.match(/\/content\/tenants\/([^/]+)\/tenant\.json$/);
	if (!match) continue;
	const slug = match[1];
	tenantMap[slug] = { ...mod.default, slug };
}

export function getTenant(slug: string): TenantConfig | null {
	const t = tenantMap[slug];
	return t && t.active ? t : null;
}

export function listTenants(): TenantConfig[] {
	return Object.values(tenantMap)
		.filter((t) => t.active)
		.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Reserved subdomains we do NOT treat as tenant slugs. Each maps to an
 * existing Peptora app or Vercel project and must continue working.
 */
const RESERVED_SUBDOMAINS = new Set([
	'www',
	'app',
	'shop',
	'sell',
	'peptora-push',
	'peptora-cms-oauth',
	'admin'
]);

/**
 * Extract tenant slug from request URL. Production routes via subdomain
 * (`<slug>.peptora.app`); dev/preview also supports path-based
 * (`localhost:5173/<slug>` or `peptora-shop.vercel.app/<slug>`) so we can
 * test without setting up wildcard DNS locally.
 *
 * Returns null if no tenant could be resolved.
 */
export function resolveTenantSlug(url: URL): string | null {
	const host = url.hostname;

	// 1. Subdomain on peptora.app or any *.peptora.app
	if (host.endsWith('.peptora.app')) {
		const sub = host.slice(0, -'.peptora.app'.length);
		if (sub && !RESERVED_SUBDOMAINS.has(sub)) return sub;
	}

	// 2. Path-based fallback (dev + preview). First path segment.
	const firstSegment = url.pathname.split('/').filter(Boolean)[0];
	if (firstSegment && !RESERVED_SUBDOMAINS.has(firstSegment)) {
		// Only treat as tenant if it actually exists — otherwise we'd hijack
		// other top-level routes like /api or /admin later.
		if (tenantMap[firstSegment]) return firstSegment;
	}

	return null;
}

/**
 * Product loader.
 *
 * Each product lives at `content/tenants/<slug>/products/<id>.md` with YAML
 * frontmatter for structured fields + optional Markdown body for rich
 * description. Files are loaded eagerly at build time via Vite's
 * `import.meta.glob` (raw query) so the runtime needs no filesystem access
 * — same pattern as tenant configs.
 *
 * If catalog grows past ~500 products per tenant we'll revisit (streaming
 * load by tenant chunk, or migrate to a DB) — well past Phase 1 scope.
 */

import matter from 'gray-matter';
import { marked } from 'marked';

/** Stock states render as different visual treatments + checkout gating. */
export type StockStatus = 'in-stock' | 'low' | 'out';

export interface Product {
	/** Tenant slug this product belongs to. Injected from file path, not file content. */
	tenantSlug: string;
	/** URL-safe product id, used in routes like `/<slug>/products/<id>`. */
	id: string;
	title: string;
	priceISK: number;
	stock: StockStatus;
	images: string[];
	category: string;
	description: string;
	/** Optional richer Markdown body, rendered as HTML in the detail page. */
	bodyHtml: string;
	/** Product properties (weight, sku, etc.) — passed through to UI. */
	weightGrams?: number;
	sku?: string;
	/** Featured products surface on the storefront home grid. */
	featured: boolean;
	/** Manual display order — lower numbers come first. */
	order: number;
}

// Eager-glob all product markdown files, raw text. Path → raw markdown string.
const productModules = import.meta.glob<string>('/content/tenants/*/products/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
});

/**
 * In-memory product index keyed by `<tenantSlug>/<productId>`. Built once at
 * module load; consumers read by slug + id (or list by slug).
 */
const productMap: Record<string, Product> = {};

for (const [path, raw] of Object.entries(productModules)) {
	const match = path.match(/\/content\/tenants\/([^/]+)\/products\/([^/]+)\.md$/);
	if (!match) continue;
	const [, tenantSlug, id] = match;

	const { data, content } = matter(raw);

	// Render markdown body to HTML. marked is synchronous in default mode.
	const bodyHtml = content.trim() ? (marked.parse(content, { async: false }) as string) : '';

	const product: Product = {
		tenantSlug,
		id,
		title: String(data.title ?? id),
		priceISK: Number(data.price_isk ?? 0),
		stock: (data.stock as StockStatus) ?? 'in-stock',
		images: Array.isArray(data.images) ? data.images.map(String) : [],
		category: String(data.category ?? 'general'),
		description: String(data.description ?? ''),
		bodyHtml,
		weightGrams: data.weight_grams != null ? Number(data.weight_grams) : undefined,
		sku: data.sku ? String(data.sku) : undefined,
		featured: Boolean(data.featured),
		order: Number(data.order ?? 999)
	};

	productMap[`${tenantSlug}/${id}`] = product;
}

/** All products for a tenant, sorted by order then by title. */
export function listProducts(tenantSlug: string): Product[] {
	return Object.values(productMap)
		.filter((p) => p.tenantSlug === tenantSlug)
		.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getProduct(tenantSlug: string, id: string): Product | null {
	return productMap[`${tenantSlug}/${id}`] ?? null;
}

/** Featured products for storefront landing. Empty list is a valid state. */
export function listFeaturedProducts(tenantSlug: string): Product[] {
	return listProducts(tenantSlug).filter((p) => p.featured);
}

/** Format ISK price with Icelandic thousand separators and "kr." suffix. */
export function formatPriceISK(amount: number): string {
	return `${amount.toLocaleString('is-IS')} kr.`;
}

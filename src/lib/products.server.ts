/**
 * Server-side product loader. The `.server.ts` suffix asks SvelteKit
 * to refuse client imports — this module pulls in markdown files via
 * Vite glob + parses them with `gray-matter` and `marked`, and those
 * have Node-leaning runtime needs (Buffer, etc.) that crash if Vite
 * bundles them for the browser.
 *
 * Client code that needs product data reads it off `data.products`
 * loaded by `+layout.server.ts`. Client code that needs only
 * formatters/types imports them from `$lib/products` (the slim
 * client-safe sibling of this file).
 *
 * If catalog grows past ~500 products per tenant we'll revisit
 * (streaming load by tenant chunk, or migrate to a DB).
 */

import matter from 'gray-matter';
import { marked } from 'marked';
import type { Product, StockStatus } from './products';

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

/**
 * Client-safe product types + formatters.
 *
 * The actual catalog loading lives in `./products.server.ts` because
 * it touches `gray-matter` / `marked` which crash in the browser. The
 * layout loads products server-side and passes them to all child
 * pages via `data.products` — client components look products up by
 * id from that array (see e.g. cart/+page.svelte).
 */

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

/** Format ISK price with Icelandic thousand separators and "kr." suffix. */
export function formatPriceISK(amount: number): string {
	return `${amount.toLocaleString('is-IS')} kr.`;
}

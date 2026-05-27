/**
 * Client-safe news types + formatters. Mirrors the products.ts /
 * products.server.ts split: `news.server.ts` does the markdown parse
 * at build time, this file only carries types + helpers that are safe
 * to import from the browser.
 */

export interface Article {
	tenantSlug: string;
	id: string; // filename slug, used in URL
	title: string;
	date: string; // YYYY-MM-DD, the article's publish date
	excerpt: string;
	image?: string;
	featured: boolean;
	bodyHtml: string;
}

export function formatArticleDate(iso: string): string {
	// "2026-05-27" → "27. maí 2026" (Icelandic locale).
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	return d.toLocaleDateString('is-IS', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

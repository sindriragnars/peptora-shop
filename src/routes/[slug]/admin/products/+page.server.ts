import { error } from '@sveltejs/kit';
import matter from 'gray-matter';
import { listDir, getTextFile } from '$lib/github-content';
import type { PageServerLoad } from './$types';

/**
 * Tenant admin — product list.
 *
 * Reads products live from GitHub via the Contents API so the list
 * reflects the most recent commits, not what's bundled in the deployed
 * build. (The storefront still reads from build-time globs — those
 * catch up after Vercel finishes rebuilding ~30 s after each commit.)
 */

interface ProductListItem {
	id: string;
	title: string;
	priceISK: number;
	stock: string;
	category: string;
	featured: boolean;
	order: number;
}

export const load: PageServerLoad = async ({ params }) => {
	const files = await listDir(`content/tenants/${params.slug}/products`);
	const items: ProductListItem[] = [];
	for (const f of files) {
		if (f.type !== 'file' || !f.name.endsWith('.md')) continue;
		const id = f.name.replace(/\.md$/, '');
		try {
			const file = await getTextFile(f.path);
			if (!file) continue;
			const { data } = matter(file.content);
			items.push({
				id,
				title: String(data.title ?? id),
				priceISK: Number(data.price_isk ?? 0),
				stock: String(data.stock ?? 'in-stock'),
				category: String(data.category ?? 'general'),
				featured: Boolean(data.featured),
				order: Number(data.order ?? 999)
			});
		} catch (e) {
			console.warn('failed to read product file', f.path, String(e));
		}
	}
	items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
	return { products: items };
};

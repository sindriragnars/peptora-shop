import matter from 'gray-matter';
import { listDir, getTextFile } from '$lib/github-content';
import type { PageServerLoad } from './$types';

/**
 * Admin news list — live from GitHub so an article just published
 * shows up immediately, without waiting on the next Vercel rebuild
 * the public /news index reads from.
 */

interface ArticleListItem {
	id: string;
	title: string;
	date: string;
	excerpt: string;
	featured: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
	const files = await listDir(`content/tenants/${params.slug}/news`).catch(() => []);
	const items: ArticleListItem[] = [];
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
				date: String(data.date ?? ''),
				excerpt: String(data.excerpt ?? ''),
				featured: Boolean(data.featured)
			});
		} catch (e) {
			console.warn('failed to read article file', f.path, String(e));
		}
	}
	// Newest first.
	items.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
	return { articles: items };
};

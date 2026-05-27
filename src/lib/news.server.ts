/**
 * Server-side news loader. Same pattern as products.server.ts —
 * eager-glob tenant news markdown, render with gray-matter + marked,
 * keep an in-memory index sorted by date (newest first).
 *
 * Public /news page reads from here (build-time, so updates land
 * ~30 s after a publish once Vercel finishes rebuilding). Admin
 * surfaces read live from GitHub via $lib/github-content so the
 * operator sees their just-saved article without waiting on a redeploy.
 */

import matter from 'gray-matter';
import { marked } from 'marked';
import type { Article } from './news';

const newsModules = import.meta.glob<string>('/content/tenants/*/news/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
});

const articleMap: Record<string, Article> = {};

for (const [path, raw] of Object.entries(newsModules)) {
	const match = path.match(/\/content\/tenants\/([^/]+)\/news\/([^/]+)\.md$/);
	if (!match) continue;
	const [, tenantSlug, id] = match;

	const { data, content } = matter(raw);
	const bodyHtml = content.trim() ? (marked.parse(content, { async: false }) as string) : '';

	const article: Article = {
		tenantSlug,
		id,
		title: String(data.title ?? id),
		date: String(data.date ?? ''),
		excerpt: String(data.excerpt ?? ''),
		image: data.image ? String(data.image) : undefined,
		featured: Boolean(data.featured),
		bodyHtml
	};

	articleMap[`${tenantSlug}/${id}`] = article;
}

/** All articles for a tenant, newest first (by date string, lexicographic). */
export function listArticles(tenantSlug: string): Article[] {
	return Object.values(articleMap)
		.filter((a) => a.tenantSlug === tenantSlug)
		.sort((a, b) => b.date.localeCompare(a.date));
}

export function getArticle(tenantSlug: string, id: string): Article | null {
	return articleMap[`${tenantSlug}/${id}`] ?? null;
}

import { listArticles } from '$lib/news.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	return { articles: listArticles(params.slug) };
};

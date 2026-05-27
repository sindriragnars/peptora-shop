import { error } from '@sveltejs/kit';
import { getArticle } from '$lib/news.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const article = getArticle(params.slug, params.id);
	if (!article) {
		throw error(404, 'Frétt fannst ekki');
	}
	return { article };
};

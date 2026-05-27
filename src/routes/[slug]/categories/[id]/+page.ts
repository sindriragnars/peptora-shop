import { error } from '@sveltejs/kit';
import { getCategory, getPeptidesByCategory } from '$lib/peptides';
import type { PageLoad } from './$types';

// SSR per tenant — see neighbouring peptides/[id]/+page.ts for why
// the original prerender + entries() got stripped.
export const load: PageLoad = ({ params }) => {
	const category = getCategory(params.id, 'en');
	if (!category) {
		throw error(404, 'Category not found');
	}
	return {
		category,
		peptides: getPeptidesByCategory(params.id, 'en')
	};
};

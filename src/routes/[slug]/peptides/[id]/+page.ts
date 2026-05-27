import { error } from '@sveltejs/kit';
import { getPeptide, getCategory } from '$lib/peptides';
import type { PageLoad } from './$types';

// SSR per tenant — peptora-shop is multi-tenant under adapter-vercel,
// so the original `prerender = true` + `entries()` (which crawled
// every peptide id at build time for the offline PWA) doesn't apply.
// Same /peptides/[id] route renders under N tenants with N brands.
export const load: PageLoad = ({ params }) => {
	const peptide = getPeptide(params.id, 'en');
	if (!peptide) {
		throw error(404, 'Peptide not found');
	}
	// Resolve the peptide's category objects for nicer rendering
	// (name + colour rather than raw id strings).
	const categories = peptide.categories
		.map((id) => getCategory(id, 'en'))
		.filter((c): c is NonNullable<typeof c> => c !== undefined);
	// Resolve `stacksWellWith` ids to full peptide records — drops any
	// that don't actually exist in the library so we never render a
	// broken link. (Some legacy data uses short ids like `kisspeptin`
	// instead of the canonical `kisspeptin-10`.)
	const stacksWith = peptide.stacksWellWith
		.map((id) => getPeptide(id, 'en'))
		.filter((p): p is NonNullable<typeof p> => p !== undefined);
	return { peptide, categories, stacksWith };
};

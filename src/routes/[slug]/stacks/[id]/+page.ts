import { error } from '@sveltejs/kit';
import { getStack, getPeptide, getInteractions } from '$lib/peptides';
import type { PageLoad } from './$types';

// SSR per tenant — peptora-shop is multi-tenant under adapter-vercel,
// so the original prerender + entries() got stripped.
export const load: PageLoad = ({ params }) => {
	const stack = getStack(params.id, 'en');
	if (!stack) {
		throw error(404, 'Stack not found');
	}
	const peptides = stack.peptides
		.map((id) => getPeptide(id, 'en'))
		.filter((p): p is NonNullable<typeof p> => p !== undefined);

	// Surface interaction warnings that involve 2+ of this stack's peptides.
	const interactions = getInteractions('en').filter((w) => {
		const overlap = w.peptides.filter((id) => stack.peptides.includes(id));
		return overlap.length >= 2;
	});

	return { stack, peptides, interactions };
};

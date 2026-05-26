import { error } from '@sveltejs/kit';
import { getProduct } from '$lib/products';
import type { PageServerLoad } from './$types';

/**
 * Load a specific product within a tenant. 404 if either the tenant doesn't
 * exist (already handled by the parent layout) or the product doesn't.
 */
export const load: PageServerLoad = async ({ params }) => {
	const product = getProduct(params.slug, params.id);
	if (!product) {
		error(404, { message: 'Vara fannst ekki' });
	}
	return { product };
};

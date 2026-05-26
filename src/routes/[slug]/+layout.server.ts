import { error } from '@sveltejs/kit';
import { getTenant } from '$lib/tenants';
import type { LayoutServerLoad } from './$types';

/**
 * Load tenant for every page under /[slug]/. If the slug doesn't map to an
 * active tenant config, 404 — keeps the storefront URL space clean and
 * stops random URLs from leaking into our render path.
 */
export const load: LayoutServerLoad = async ({ params }) => {
	const tenant = getTenant(params.slug);
	if (!tenant) {
		error(404, { message: 'Storefront not found' });
	}
	return { tenant };
};

import { error } from '@sveltejs/kit';
import { getTenant } from '$lib/tenants';
import { listProducts } from '$lib/products.server';
import type { LayoutServerLoad } from './$types';

/**
 * Load tenant + product catalog for every page under /[slug]/. If the
 * slug doesn't map to an active tenant config, 404 — keeps the storefront
 * URL space clean and stops random URLs from leaking into our render path.
 *
 * Products ride along on the layout data so client-side cart/checkout
 * pages can look up product metadata (title, price, image) by id
 * without importing the markdown parser into the browser bundle.
 */
export const load: LayoutServerLoad = async ({ params, url }) => {
	const tenant = getTenant(params.slug);
	if (!tenant) {
		error(404, { message: 'Storefront not found' });
	}
	// On the tenant's own subdomain (jonnyb.peptora.app), all routes
	// already imply the slug — strip it from generated link hrefs so
	// the URL bar reads `/products/foo` instead of `/jonnyb/products/foo`.
	// On path-based access (shop.peptora.app/jonnyb/...) the slug must
	// stay in links.
	const onSubdomain = url.hostname === `${tenant.slug}.peptora.app`;
	return {
		tenant,
		products: listProducts(tenant.slug),
		pathPrefix: onSubdomain ? '' : `/${tenant.slug}`
	};
};

import { getTenant, resolveTenantSlug } from '$lib/tenants';
import type { Handle } from '@sveltejs/kit';

/**
 * Resolve tenant on every request and stash it on `event.locals`. Routes
 * that need a tenant read `locals.tenant`; routes that don't (the platform
 * landing page, /api, /admin) ignore it.
 *
 * We don't reject requests here even if no tenant is found — the route
 * itself decides whether absence is fatal (storefront → 404) or fine
 * (platform landing page → render tenant list).
 */
export const handle: Handle = async ({ event, resolve }) => {
	const slug = resolveTenantSlug(event.url);
	event.locals.tenant = slug ? getTenant(slug) : null;
	return resolve(event);
};

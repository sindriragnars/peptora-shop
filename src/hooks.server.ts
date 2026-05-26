import { getTenant, resolveTenantSlug } from '$lib/tenants';
import { isAuthorizedAdmin, unauthorizedResponse } from '$lib/admin-auth';
import type { Handle } from '@sveltejs/kit';

/**
 * Request middleware:
 *
 * 1. Resolve tenant from subdomain or path and stash on `event.locals`
 *    so any route can read `locals.tenant` without re-parsing.
 *
 * 2. If the tenant was resolved from the subdomain (path doesn't
 *    already contain the slug), rewrite the URL pathname so SvelteKit's
 *    router can match the `[slug]/...` routes. Without this rewrite
 *    `demo.peptora.app/admin/orders` hits the root, not the storefront.
 *
 * 3. Gate every URL under `/<slug>/admin/` with HTTP Basic Auth. Done
 *    in the hook because raw 401 Responses with WWW-Authenticate can't
 *    be thrown from `+layout.server.ts` (SvelteKit treats those as 500).
 */
export const handle: Handle = async ({ event, resolve }) => {
	const slug = resolveTenantSlug(event.url);
	const tenant = slug ? getTenant(slug) : null;
	event.locals.tenant = tenant;

	// Subdomain → path rewrite. Guard against double-prefixing if the
	// visitor accidentally hits demo.peptora.app/demo/... ourselves.
	if (tenant) {
		const expectedPrefix = `/${tenant.slug}`;
		const pathStartsWithSlug =
			event.url.pathname === expectedPrefix ||
			event.url.pathname.startsWith(`${expectedPrefix}/`);
		if (!pathStartsWithSlug) {
			event.url.pathname = `${expectedPrefix}${event.url.pathname}`;
		}
	}

	// Admin gate. After the rewrite above the pathname always has
	// /<slug>/admin form regardless of subdomain vs path arrival.
	if (tenant) {
		const adminPrefix = `/${tenant.slug}/admin`;
		if (
			event.url.pathname.startsWith(adminPrefix) &&
			!isAuthorizedAdmin({ request: event.request, tenant })
		) {
			return unauthorizedResponse(tenant);
		}
	}

	return resolve(event);
};

import { getTenant, resolveTenantSlug } from '$lib/tenants';
import { isAuthorizedAdmin, unauthorizedResponse } from '$lib/admin-auth';
import type { Handle } from '@sveltejs/kit';

/**
 * Request middleware:
 *
 * 1. Resolve tenant from subdomain or path and stash on `event.locals`
 *    so any route can read `locals.tenant` without re-parsing.
 *
 * 2. Gate every URL under `/<slug>/admin/` with HTTP Basic Auth. The
 *    `+layout.server.ts` under admin/ can't return a raw Response with
 *    WWW-Authenticate (SvelteKit treats those as 500), so the gate
 *    runs here in the request hook where raw Responses are first-class.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const slug = resolveTenantSlug(event.url);
	const tenant = slug ? getTenant(slug) : null;
	event.locals.tenant = tenant;

	// Path-based admin gate. Matches both subdomain and path-routed
	// tenants because we extract the slug from the URL regardless of
	// how the visitor arrived. /admin (no slug — platform-level) is
	// not protected here; if we add one in Phase 6 it gets its own
	// auth.
	if (tenant) {
		const adminPrefix = `/${tenant.slug}/admin`;
		const pathnameSubdomain = event.url.pathname; // when tenant on subdomain, pathname starts with /admin
		const pathnameWithSlug = event.url.pathname; // path-based: starts with /<slug>/admin

		const isAdminRoute =
			pathnameWithSlug.startsWith(adminPrefix) ||
			(event.url.hostname.endsWith('.peptora.app') && pathnameSubdomain.startsWith('/admin'));

		if (isAdminRoute && !isAuthorizedAdmin({ request: event.request, tenant })) {
			return unauthorizedResponse(tenant);
		}
	}

	return resolve(event);
};

import { getTenant, resolveTenantSlug } from '$lib/tenants';
import {
	isAuthorizedAdmin,
	isAuthorizedPlatformAdmin,
	platformUnauthorizedResponse,
	unauthorizedResponse
} from '$lib/admin-auth';
import type { Handle } from '@sveltejs/kit';

/**
 * Request middleware:
 *
 * 1. Resolve tenant from subdomain or path and stash on `event.locals`
 *    so any route can read `locals.tenant` without re-parsing.
 *
 * 2. Gate every admin URL with HTTP Basic Auth. Done in the hook
 *    because raw 401 Responses with WWW-Authenticate can't be thrown
 *    from `+layout.server.ts` (SvelteKit treats those as 500).
 *
 * URL rewriting for subdomain → /<slug>/<path> lives in the universal
 * `reroute` hook (`src/hooks.ts`) — that's the only thing SvelteKit
 * consults for route matching. The admin gate checks both forms of
 * pathname here because reroute affects routing, not the URL the gate
 * inspects.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const slug = resolveTenantSlug(event.url);
	const tenant = slug ? getTenant(slug) : null;
	event.locals.tenant = tenant;

	if (tenant) {
		const pathBasedAdmin = event.url.pathname.startsWith(`/${tenant.slug}/admin`);
		const subdomainAdmin =
			event.url.hostname === `${tenant.slug}.peptora.app` &&
			event.url.pathname.startsWith('/admin');
		if (
			(pathBasedAdmin || subdomainAdmin) &&
			!isAuthorizedAdmin({ request: event.request, tenant })
		) {
			return unauthorizedResponse(tenant);
		}
	}

	// Platform admin (no tenant context). Fires for /admin/* on
	// shop.peptora.app, peptora-shop.vercel.app, or any reserved-
	// subdomain host. Lets the Peptora team review signup applications,
	// manage platform settings later. Distinct password from any
	// per-tenant admin so a tenant breach can't escalate.
	if (!tenant && event.url.pathname.startsWith('/admin')) {
		if (!isAuthorizedPlatformAdmin(event.request)) {
			return platformUnauthorizedResponse();
		}
	}

	return resolve(event);
};

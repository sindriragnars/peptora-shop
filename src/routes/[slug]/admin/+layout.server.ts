import { error } from '@sveltejs/kit';
import { isAuthorizedAdmin, unauthorizedResponse } from '$lib/admin-auth';
import type { LayoutServerLoad } from './$types';

/**
 * Guard for every page under /[slug]/admin/. Runs Basic-Auth check
 * against the per-tenant password env var. Returns 401 with
 * WWW-Authenticate so the browser shows its native credentials prompt.
 *
 * `error(401, ...)` throws SvelteKit's HttpError which renders an
 * error page in this layout chain — but for Basic Auth we want to
 * return the WWW-Authenticate header instead, which is why we throw
 * a raw Response below.
 */
export const load: LayoutServerLoad = async ({ request, parent }) => {
	const parentData = await parent();
	const tenant = parentData.tenant;

	if (!isAuthorizedAdmin({ request, tenant })) {
		// Throwing a Response triggers SvelteKit to send it verbatim,
		// including the WWW-Authenticate header that prompts the browser.
		throw unauthorizedResponse(tenant);
	}

	return {};
};

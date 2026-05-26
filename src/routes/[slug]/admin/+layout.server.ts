import type { LayoutServerLoad } from './$types';

/**
 * The actual Basic-Auth gate runs in `src/hooks.server.ts` because it
 * needs to return a raw 401 Response with `WWW-Authenticate` — SvelteKit
 * load functions can't do that.
 *
 * This layout just forwards parent data; admin pages access tenant via
 * `parent()` below them. Kept as a marker file so the admin/* subtree
 * is grouped under one layout and we have a hook point for any future
 * shared admin chrome (nav, breadcrumbs, etc).
 */
export const load: LayoutServerLoad = async ({ parent }) => parent();

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Dynamic PWA manifest scoped per tenant.
 *
 * Chrome's "Install app" prompt requires a manifest with name, icons,
 * and display: standalone. We serve it per host so jonnyb.peptora.app
 * installs as "Jonny B" with his brand colour, palli.peptora.app as
 * "Palli" with his, and so on — same codebase, branded shell on the
 * home screen.
 *
 * Icons are inline SVG endpoints (also per tenant), avoiding the need
 * for every tenant to upload PNG icon assets up front. Once a tenant
 * supplies a logo we can switch their icon URL to point at it.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	const tenant = locals.tenant;
	const name = tenant?.name ?? 'Peptora';
	const themeBrand = tenant?.theme.brand ?? '#0e7c66';

	// `start_url` and `scope` are the tenant root. On a subdomain that's
	// "/", on path-based access it's "/<slug>/". We can read scope from
	// the request — subdomain hosts already have the slug stripped from
	// the URL by the reroute hook.
	const onSubdomain = tenant && url.hostname === `${tenant.slug}.peptora.app`;
	const scope = tenant && !onSubdomain ? `/${tenant.slug}/` : '/';

	return json(
		{
			name,
			short_name: name,
			start_url: scope,
			scope,
			display: 'standalone',
			background_color: '#f5f1e8',
			theme_color: themeBrand,
			icons: [
				{
					src: `${scope}pwa-icon.svg`,
					sizes: 'any',
					type: 'image/svg+xml',
					purpose: 'any'
				},
				{
					src: `${scope}pwa-icon.svg`,
					sizes: 'any',
					type: 'image/svg+xml',
					purpose: 'maskable'
				}
			]
		},
		{
			headers: {
				'Content-Type': 'application/manifest+json',
				'Cache-Control': 'public, max-age=300'
			}
		}
	);
};

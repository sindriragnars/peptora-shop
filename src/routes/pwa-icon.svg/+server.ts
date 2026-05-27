import type { RequestHandler } from './$types';

/**
 * Per-tenant PWA / Apple touch icon. Rendered as SVG so we don't need
 * each tenant to upload PNG assets up front — the manifest references
 * this endpoint by URL. Until a tenant supplies their own logo, we
 * show a coloured square (their brand) with the first letter of their
 * name in cream.
 *
 * The 512×512 viewBox + safe-area inset (~10%) makes the icon work
 * for both "any" and "maskable" purposes — masking shaves up to ~20%
 * from each edge and the letter stays inside the safe zone.
 */
export const GET: RequestHandler = async ({ locals }) => {
	const tenant = locals.tenant;
	const name = tenant?.name ?? 'Peptora';
	const brand = tenant?.theme.brand ?? '#0e7c66';
	const initial = name.trim().charAt(0).toUpperCase() || 'P';

	const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${brand}"/>
  <text
    x="256"
    y="256"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-weight="700"
    font-size="280"
    fill="#f5f1e8"
  >${initial}</text>
</svg>`;

	return new Response(svg, {
		headers: {
			'Content-Type': 'image/svg+xml',
			'Cache-Control': 'public, max-age=300'
		}
	});
};

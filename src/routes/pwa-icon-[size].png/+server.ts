import sharp from 'sharp';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * PNG-rendered tenant icon. Sister of /pwa-icon.svg — same coloured
 * square + initial, but rasterized so Chrome / Edge accept it for
 * "Install app" eligibility. Their install-prompt check rejects
 * `image/svg+xml` icons regardless of what the W3C spec says.
 *
 * Size is parameterised so the manifest can request 192 + 512 (the
 * Chrome minimums) from the same code path. We clamp to a sane
 * range so a hostile request can't spawn a 16k-pixel render job.
 */

const ALLOWED_SIZES = new Set([192, 256, 384, 512, 1024]);

export const GET: RequestHandler = async ({ locals, params }) => {
	const size = Number(params.size);
	if (!ALLOWED_SIZES.has(size)) {
		error(404, { message: 'Unknown icon size' });
	}

	const tenant = locals.tenant;
	const name = tenant?.name ?? 'Peptora';
	const brand = tenant?.theme.brand ?? '#0e7c66';
	const initial = name.trim().charAt(0).toUpperCase() || 'P';

	// Render at a fixed viewBox so the letter scales proportionally
	// regardless of the requested output size.
	const fontSize = Math.round(size * 0.55);
	const svg = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${brand}"/>
  <text
    x="50%"
    y="50%"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="-apple-system, 'Segoe UI', Roboto, sans-serif"
    font-weight="700"
    font-size="${fontSize}"
    fill="#f5f1e8"
  >${initial}</text>
</svg>`
	);

	const png = await sharp(svg).png().toBuffer();

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			'Cache-Control': 'public, max-age=86400'
		}
	});
};

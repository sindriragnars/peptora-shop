import { read } from '$app/server';
import sharp from 'sharp';
import { error } from '@sveltejs/kit';
import sourceUrl from '$lib/pwa-source.png?url';
import type { RequestHandler } from './$types';

/**
 * PNG-rendered Peptora icon at the requested size.
 *
 * Source: src/lib/pwa-source.png (1024×1024). Imported as a Vite asset
 * + read via $app/server.read so the binary is bundled into the
 * Vercel serverless function — `static/` files aren't available via
 * fs at runtime on Vercel, only via HTTP. Resized on demand via sharp
 * so the manifest can request 192 + 512 (the Chrome minimums) from
 * the same code path. Size is clamped to a known set so a hostile
 * request can't spawn a 16k-pixel job.
 *
 * Deliberately tenant-agnostic: every tenant subdomain installs as
 * "Peptora" with the Peptora icon — Sindri wants the install experience
 * unified across the platform, even though the in-app content stays
 * tenant-scoped (Jonny B's shop, Palli's shop, etc.).
 */

const ALLOWED_SIZES = new Set([192, 256, 384, 512, 1024]);

export const GET: RequestHandler = async ({ params }) => {
	const size = Number(params.size);
	if (!ALLOWED_SIZES.has(size)) {
		error(404, { message: 'Unknown icon size' });
	}

	const source = Buffer.from(await read(sourceUrl).arrayBuffer());
	const png = await sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer();

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			// 1-day browser cache. PWA icons don't change often.
			'Cache-Control': 'public, max-age=86400, immutable'
		}
	});
};

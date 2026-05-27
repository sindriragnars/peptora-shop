import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * PNG-rendered Peptora icon at the requested size.
 *
 * Source: static/pwa-source.png (1024×1024). Resized on demand via
 * sharp so the manifest can request 192 + 512 (the Chrome minimums)
 * from the same code path. Size is clamped to a known set so a hostile
 * request can't spawn a 16k-pixel job.
 *
 * Deliberately tenant-agnostic: every tenant subdomain installs as
 * "Peptora" with the Peptora icon — Sindri wants the install experience
 * unified across the platform, even though the in-app content stays
 * tenant-scoped (Jonny B's shop, Palli's shop, etc.).
 */

const ALLOWED_SIZES = new Set([192, 256, 384, 512, 1024]);

// Resolve once: static/pwa-source.png lives at <project-root>/static/.
// import.meta.url won't help under adapter-vercel's serverless bundle,
// so trust process.cwd() which Vercel sets to the project root.
const SOURCE_PATH = path.join(process.cwd(), 'static', 'pwa-source.png');

export const GET: RequestHandler = async ({ params }) => {
	const size = Number(params.size);
	if (!ALLOWED_SIZES.has(size)) {
		error(404, { message: 'Unknown icon size' });
	}

	const source = await readFile(SOURCE_PATH);
	const png = await sharp(source).resize(size, size, { fit: 'cover' }).png().toBuffer();

	return new Response(png, {
		headers: {
			'Content-Type': 'image/png',
			// 1-day browser cache. PWA icons don't change often.
			'Cache-Control': 'public, max-age=86400, immutable'
		}
	});
};

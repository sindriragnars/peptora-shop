import { json } from '@sveltejs/kit';
import { putBinaryFile } from '$lib/github-content';
import type { RequestHandler } from './$types';

/**
 * Tenant admin — image upload.
 *
 * Auth is enforced upstream by the Basic-Auth gate in hooks.server.ts
 * because the path is under /<slug>/admin/. This endpoint just commits
 * the uploaded file under static/tenants/<slug>/images/<safe-filename>
 * and returns the public URL the form can store in product.images[].
 *
 * Accepts multipart form-data with field name "image".
 */

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB hard ceiling
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const EXT_BY_MIME: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/svg+xml': 'svg'
};

function safeStem(name: string): string {
	const base = name
		.replace(/\.[^.]+$/, '')
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return base || 'image';
}

export const POST: RequestHandler = async ({ params, request }) => {
	const form = await request.formData();
	const file = form.get('image');
	if (!(file instanceof File)) {
		return json({ error: 'image field missing' }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return json({ error: `Mynd of stór (${Math.round(file.size / 1024)} KB; max 5 MB)` }, { status: 413 });
	}
	if (!ALLOWED_MIME.has(file.type)) {
		return json({ error: `Tegund leyfist ekki: ${file.type}` }, { status: 415 });
	}

	const ext = EXT_BY_MIME[file.type] ?? 'bin';
	const stem = safeStem(file.name);
	// Append timestamp to avoid clobbering existing uploads with the
	// same source filename.
	const filename = `${stem}-${Date.now()}.${ext}`;
	const path = `static/tenants/${params.slug}/images/${filename}`;

	const buf = Buffer.from(await file.arrayBuffer());
	const base64 = buf.toString('base64');

	try {
		await putBinaryFile(path, base64, `Upload image ${filename} for tenant ${params.slug}`);
	} catch (e) {
		console.error('image upload failed', String(e));
		return json({ error: 'upload failed' }, { status: 502 });
	}

	const publicUrl = `/tenants/${params.slug}/images/${filename}`;
	return json({ url: publicUrl, filename });
};

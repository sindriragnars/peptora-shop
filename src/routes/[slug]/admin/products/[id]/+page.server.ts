import { error, fail, redirect } from '@sveltejs/kit';
import matter from 'gray-matter';
import {
	getTextFile,
	putTextFile,
	deleteFile as deleteGithubFile
} from '$lib/github-content';
import type { Actions, PageServerLoad } from './$types';

/**
 * Tenant admin — product create / edit / delete.
 *
 * Special id `new` = create mode (no existing file, no sha required).
 * Anything else = edit mode (fetch from GitHub, get sha for the update
 * conditional write).
 *
 * All writes go through the platform-owned GITHUB_TOKEN; the tenant
 * never sees a GitHub credential. Auth happens upstream via the
 * Basic-Auth gate in hooks.server.ts (per-tenant <SLUG>_ADMIN_PASSWORD).
 */

const ID_RE = /^[a-z0-9][a-z0-9-]{0,59}$/;

interface ProductFormState {
	id: string;
	title: string;
	description: string;
	price_isk: number;
	stock: 'in-stock' | 'low' | 'out';
	category: 'peptides' | 'stack' | 'supplies' | 'general';
	featured: boolean;
	order: number;
	weight_grams: number | null;
	sku: string;
	images: string[];
	body: string;
	/** GitHub sha — needed for updates, empty for new products. */
	sha?: string;
}

function emptyForm(id: string): ProductFormState {
	return {
		id,
		title: '',
		description: '',
		price_isk: 0,
		stock: 'in-stock',
		category: 'peptides',
		featured: false,
		order: 100,
		weight_grams: null,
		sku: '',
		images: [],
		body: ''
	};
}

export const load: PageServerLoad = async ({ params }) => {
	if (params.id === 'new') {
		return { form: emptyForm(''), isNew: true };
	}
	const file = await getTextFile(`content/tenants/${params.slug}/products/${params.id}.md`);
	if (!file) error(404, { message: 'Vara fannst ekki' });
	const { data, content } = matter(file.content);
	const form: ProductFormState = {
		id: params.id,
		title: String(data.title ?? params.id),
		description: String(data.description ?? ''),
		price_isk: Number(data.price_isk ?? 0),
		stock: (data.stock as ProductFormState['stock']) ?? 'in-stock',
		category: (data.category as ProductFormState['category']) ?? 'peptides',
		featured: Boolean(data.featured),
		order: Number(data.order ?? 100),
		weight_grams: data.weight_grams != null ? Number(data.weight_grams) : null,
		sku: String(data.sku ?? ''),
		images: Array.isArray(data.images) ? data.images.map(String) : [],
		body: content.trimStart(),
		sha: file.sha
	};
	return { form, isNew: false };
};

function readForm(data: FormData): ProductFormState {
	return {
		id: String(data.get('id') ?? '').trim().toLowerCase(),
		title: String(data.get('title') ?? '').trim(),
		description: String(data.get('description') ?? '').trim(),
		price_isk: Number(data.get('price_isk') ?? 0),
		stock: String(data.get('stock') ?? 'in-stock') as ProductFormState['stock'],
		category: String(data.get('category') ?? 'peptides') as ProductFormState['category'],
		featured: data.get('featured') === 'on',
		order: Number(data.get('order') ?? 100),
		weight_grams: data.get('weight_grams') ? Number(data.get('weight_grams')) : null,
		sku: String(data.get('sku') ?? '').trim(),
		images: String(data.get('images') ?? '')
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean),
		body: String(data.get('body') ?? ''),
		sha: String(data.get('sha') ?? '') || undefined
	};
}

function serializeMarkdown(fm: ProductFormState): string {
	const yamlString = (s: string) => {
		if (s === '') return "''";
		if (/[:#&*!|>'"%@`,\[\]{}\n\r]/.test(s) || /^\s|\s$/.test(s)) {
			return `'${s.replace(/'/g, "''")}'`;
		}
		return s;
	};
	const lines: string[] = ['---'];
	lines.push(`title: ${yamlString(fm.title)}`);
	lines.push(`description: ${yamlString(fm.description)}`);
	lines.push(`price_isk: ${fm.price_isk}`);
	lines.push(`stock: ${fm.stock}`);
	lines.push(`category: ${fm.category}`);
	if (fm.images.length > 0) {
		lines.push('images:');
		for (const img of fm.images) lines.push(`  - ${img}`);
	} else {
		lines.push('images: []');
	}
	if (fm.weight_grams != null) lines.push(`weight_grams: ${fm.weight_grams}`);
	if (fm.sku) lines.push(`sku: ${yamlString(fm.sku)}`);
	lines.push(`featured: ${fm.featured}`);
	lines.push(`order: ${fm.order}`);
	lines.push('---');
	lines.push('');
	lines.push(fm.body.trim());
	lines.push('');
	return lines.join('\n');
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const data = await request.formData();
		const form = readForm(data);
		const isNew = params.id === 'new';

		const errors: Record<string, string> = {};
		if (!ID_RE.test(form.id)) errors.id = 'Slug verður að vera lowercase, tölur og bandstrik (2–60 stafir).';
		if (form.title.length < 1) errors.title = 'Heiti er nauðsynlegt.';
		if (form.description.length < 1) errors.description = 'Lýsing er nauðsynleg.';
		if (!(form.price_isk >= 0) || form.price_isk > 10000000) errors.price_isk = 'Verð verður að vera 0–10.000.000.';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: form });
		}

		// If renaming a product (id changed in edit mode), delete the old
		// file and create a new one. Otherwise just update in place.
		const oldId = isNew ? null : params.id;
		const newPath = `content/tenants/${params.slug}/products/${form.id}.md`;
		const md = serializeMarkdown(form);

		try {
			if (oldId && oldId !== form.id) {
				// Rename: create at new path, then delete old.
				await putTextFile(newPath, md, `Add product ${form.id}`);
				if (form.sha) {
					await deleteGithubFile(
						`content/tenants/${params.slug}/products/${oldId}.md`,
						form.sha,
						`Delete old product ${oldId} (renamed to ${form.id})`
					);
				}
			} else {
				await putTextFile(
					newPath,
					md,
					isNew ? `Add product ${form.id}` : `Update product ${form.id}`,
					form.sha
				);
			}
		} catch (e) {
			return fail(502, { errors: { _form: String(e) }, values: form });
		}

		// Redirect to the canonical edit URL so the URL bar matches the
		// (possibly renamed) id and a refresh re-fetches via GET.
		throw redirect(303, `/${params.slug}/admin/products/${form.id}`);
	},
	delete: async ({ params, request }) => {
		const data = await request.formData();
		const sha = String(data.get('sha') ?? '');
		if (params.id === 'new' || !sha) return fail(400, { error: 'cannot delete' });
		try {
			await deleteGithubFile(
				`content/tenants/${params.slug}/products/${params.id}.md`,
				sha,
				`Delete product ${params.id}`
			);
		} catch (e) {
			return fail(502, { error: String(e) });
		}
		throw redirect(303, `/${params.slug}/admin/products`);
	}
};

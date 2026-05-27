import { error, fail, redirect } from '@sveltejs/kit';
import matter from 'gray-matter';
import {
	getTextFile,
	putTextFile,
	deleteFile as deleteGithubFile
} from '$lib/github-content';
import type { Actions, PageServerLoad } from './$types';

/**
 * Tenant admin — article create / edit / delete.
 *
 * Mirrors the product edit flow: id `new` = create mode, anything else
 * loads an existing markdown file via GitHub Contents API (sha-conditional
 * write). All writes go through the platform GITHUB_TOKEN; tenants
 * never see a GitHub credential. Basic Auth gate lives upstream in
 * hooks.server.ts.
 */

const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

interface ArticleFormState {
	id: string;
	title: string;
	date: string; // YYYY-MM-DD
	excerpt: string;
	image: string;
	featured: boolean;
	body: string;
	sha?: string;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function emptyForm(): ArticleFormState {
	return {
		id: '',
		title: '',
		date: today(),
		excerpt: '',
		image: '',
		featured: false,
		body: ''
	};
}

export const load: PageServerLoad = async ({ params }) => {
	if (params.id === 'new') {
		return { form: emptyForm(), isNew: true };
	}
	const file = await getTextFile(`content/tenants/${params.slug}/news/${params.id}.md`);
	if (!file) error(404, { message: 'Frétt fannst ekki' });
	const { data, content } = matter(file.content);
	const form: ArticleFormState = {
		id: params.id,
		title: String(data.title ?? params.id),
		date: String(data.date ?? today()),
		excerpt: String(data.excerpt ?? ''),
		image: String(data.image ?? ''),
		featured: Boolean(data.featured),
		body: content.trimStart(),
		sha: file.sha
	};
	return { form, isNew: false };
};

function readForm(data: FormData): ArticleFormState {
	return {
		id: String(data.get('id') ?? '').trim().toLowerCase(),
		title: String(data.get('title') ?? '').trim(),
		date: String(data.get('date') ?? '').trim(),
		excerpt: String(data.get('excerpt') ?? '').trim(),
		image: String(data.get('image') ?? '').trim(),
		featured: data.get('featured') === 'on',
		body: String(data.get('body') ?? ''),
		sha: String(data.get('sha') ?? '') || undefined
	};
}

function serializeMarkdown(fm: ArticleFormState): string {
	const yamlString = (s: string) => {
		if (s === '') return "''";
		if (/[:#&*!|>'"%@`,\[\]{}\n\r]/.test(s) || /^\s|\s$/.test(s)) {
			return `'${s.replace(/'/g, "''")}'`;
		}
		return s;
	};
	const lines: string[] = ['---'];
	lines.push(`title: ${yamlString(fm.title)}`);
	lines.push(`date: ${fm.date}`);
	lines.push(`excerpt: ${yamlString(fm.excerpt)}`);
	if (fm.image) lines.push(`image: ${yamlString(fm.image)}`);
	lines.push(`featured: ${fm.featured}`);
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
		if (!ID_RE.test(form.id)) errors.id = 'Slug verður að vera lowercase, tölur og bandstrik (2–80 stafir).';
		if (form.title.length < 1) errors.title = 'Fyrirsögn er nauðsynleg.';
		if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) errors.date = 'Dagsetning verður að vera YYYY-MM-DD.';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values: form });
		}

		const oldId = isNew ? null : params.id;
		const newPath = `content/tenants/${params.slug}/news/${form.id}.md`;
		const md = serializeMarkdown(form);

		try {
			if (oldId && oldId !== form.id) {
				// Rename: create at new path, then delete old.
				await putTextFile(newPath, md, `Add article ${form.id}`);
				if (form.sha) {
					await deleteGithubFile(
						`content/tenants/${params.slug}/news/${oldId}.md`,
						form.sha,
						`Delete old article ${oldId} (renamed to ${form.id})`
					);
				}
			} else {
				await putTextFile(
					newPath,
					md,
					isNew ? `Add article ${form.id}` : `Update article ${form.id}`,
					form.sha
				);
			}
		} catch (e) {
			return fail(502, { errors: { _form: String(e) }, values: form });
		}

		throw redirect(303, `/${params.slug}/admin/news/${form.id}`);
	},
	delete: async ({ params, request }) => {
		const data = await request.formData();
		const sha = String(data.get('sha') ?? '');
		if (params.id === 'new') {
			return fail(400, { errors: { _form: 'Cannot delete a new (unsaved) article.' } });
		}
		if (!sha) {
			// Re-fetch the current sha so a stale form (page open for a while)
			// or a missing hidden field doesn't silently no-op the delete.
			const fresh = await getTextFile(
				`content/tenants/${params.slug}/news/${params.id}.md`
			);
			if (!fresh) {
				return fail(404, { errors: { _form: 'Frétt fannst ekki á GitHub.' } });
			}
			try {
				await deleteGithubFile(
					`content/tenants/${params.slug}/news/${params.id}.md`,
					fresh.sha,
					`Delete article ${params.id}`
				);
			} catch (e) {
				return fail(502, { errors: { _form: `Eyðing mistókst: ${String(e)}` } });
			}
			throw redirect(303, `/${params.slug}/admin/news`);
		}
		try {
			await deleteGithubFile(
				`content/tenants/${params.slug}/news/${params.id}.md`,
				sha,
				`Delete article ${params.id}`
			);
		} catch (e) {
			return fail(502, { errors: { _form: `Eyðing mistókst: ${String(e)}` } });
		}
		throw redirect(303, `/${params.slug}/admin/news`);
	}
};

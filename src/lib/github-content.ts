/**
 * GitHub Contents API wrapper — used by the tenant admin UI to commit
 * product .md files + product images on behalf of tenants who don't
 * have their own GitHub account.
 *
 * The commits happen under a single platform-owned PAT
 * (process.env.GITHUB_TOKEN). All tenant admin auth is enforced
 * upstream (per-tenant Basic Auth via hooks.server.ts); this module
 * just trusts the caller and performs the API call.
 *
 * Server-only. Don't import into .svelte files — the token would
 * leak into the client bundle.
 */

const API_BASE = 'https://api.github.com';

function token(): string {
	const t = process.env.GITHUB_TOKEN;
	if (!t) throw new Error('GITHUB_TOKEN env var missing — see .env.example');
	return t;
}

interface RepoCfg {
	owner: string;
	name: string;
	branch: string;
}
function repo(): RepoCfg {
	return {
		owner: process.env.GITHUB_REPO_OWNER ?? 'sindriragnars',
		name: process.env.GITHUB_REPO_NAME ?? 'peptora-shop',
		branch: process.env.GITHUB_BRANCH ?? 'main'
	};
}

async function gh(method: string, path: string, body?: unknown): Promise<unknown> {
	const { owner, name, branch } = repo();
	const url = `${API_BASE}/repos/${owner}/${name}/contents/${encodeURI(path)}?ref=${branch}`;
	const r = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token()}`,
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'Content-Type': 'application/json'
		},
		body: body ? JSON.stringify(body) : undefined
	});
	if (!r.ok) {
		// 404 on GET is "doesn't exist" — let the caller decide.
		if (method === 'GET' && r.status === 404) return null;
		const text = await r.text();
		throw new Error(`GitHub ${method} ${path} → ${r.status}: ${text}`);
	}
	return r.json();
}

export interface ListedFile {
	name: string;
	path: string;
	sha: string;
	type: 'file' | 'dir';
}

/** List files in a repo directory. Returns [] if the directory is empty or missing. */
export async function listDir(path: string): Promise<ListedFile[]> {
	const json = await gh('GET', path);
	if (!json) return [];
	return Array.isArray(json) ? (json as ListedFile[]) : [];
}

/** Fetch a text file's content + sha. Returns null if missing. */
export async function getTextFile(path: string): Promise<{ content: string; sha: string } | null> {
	const json = (await gh('GET', path)) as { content?: string; encoding?: string; sha?: string } | null;
	if (!json || !json.content || !json.sha) return null;
	const decoded = Buffer.from(json.content, 'base64').toString('utf8');
	return { content: decoded, sha: json.sha };
}

/** Create or update a text file. Provide existingSha for updates; omit for creates. */
export async function putTextFile(
	path: string,
	content: string,
	message: string,
	existingSha?: string
): Promise<{ sha: string }> {
	const body: Record<string, unknown> = {
		message,
		content: Buffer.from(content, 'utf8').toString('base64'),
		branch: repo().branch,
		committer: { name: 'Peptora Shop', email: 'bot@peptora.app' }
	};
	if (existingSha) body.sha = existingSha;
	const json = (await gh('PUT', path, body)) as { content: { sha: string } };
	return { sha: json.content.sha };
}

/** Create or update a binary file (image, PDF, etc.). Content is base64-encoded. */
export async function putBinaryFile(
	path: string,
	base64Content: string,
	message: string,
	existingSha?: string
): Promise<{ sha: string }> {
	const body: Record<string, unknown> = {
		message,
		content: base64Content,
		branch: repo().branch,
		committer: { name: 'Peptora Shop', email: 'bot@peptora.app' }
	};
	if (existingSha) body.sha = existingSha;
	const json = (await gh('PUT', path, body)) as { content: { sha: string } };
	return { sha: json.content.sha };
}

/** Delete a file. Sha required by GitHub API. */
export async function deleteFile(path: string, sha: string, message: string): Promise<void> {
	await gh('DELETE', path, {
		message,
		sha,
		branch: repo().branch,
		committer: { name: 'Peptora Shop', email: 'bot@peptora.app' }
	});
}

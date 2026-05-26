/**
 * HTTP Basic Auth for tenant admin routes.
 *
 * Convention: per-tenant password lives in env var `<SLUG_UPPER>_ADMIN_PASSWORD`.
 * Browser handles the credentials prompt natively — no login page, no
 * session cookie, no JWT. The trade-off is no "logout" button; the
 * customer clears credentials by closing the browser or visiting in
 * private mode. For a 1-2 operator admin dashboard that's acceptable.
 *
 * The 401 response includes `WWW-Authenticate: Basic realm="<tenant>"`
 * so the browser shows a contextual prompt per tenant.
 */
import type { Cookies } from '@sveltejs/kit';
import type { TenantConfig } from './tenants';

export interface BasicAuthHeader {
	user: string;
	pass: string;
}

/** Parse Basic Auth from `Authorization: Basic <base64>` header. */
function parseBasic(authHeader: string | null): BasicAuthHeader | null {
	if (!authHeader || !authHeader.startsWith('Basic ')) return null;
	try {
		const decoded = atob(authHeader.slice('Basic '.length));
		const idx = decoded.indexOf(':');
		if (idx < 0) return null;
		return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
	} catch {
		return null;
	}
}

/**
 * Resolve a tenant's admin password from env. Convention is
 * <SLUG_UPPER>_ADMIN_PASSWORD; can be overridden via tenant.adminPasswordRef
 * later if a tenant wants a custom env var name.
 */
function getAdminPassword(tenant: TenantConfig): string | null {
	const envName = `${tenant.slug.toUpperCase().replace(/-/g, '_')}_ADMIN_PASSWORD`;
	return process.env[envName] ?? null;
}

/**
 * Check Basic Auth against the tenant's admin password. Constant-time
 * compare so we don't leak timing differences.
 *
 * Returns true if authorized. Caller is responsible for sending the
 * 401 response when this returns false.
 */
export function isAuthorizedAdmin(opts: {
	request: Request;
	tenant: TenantConfig;
}): boolean {
	const expected = getAdminPassword(opts.tenant);
	if (!expected) return false; // not configured = locked

	const provided = parseBasic(opts.request.headers.get('Authorization'));
	if (!provided) return false;

	// Username is fixed to "admin" — only the password is the secret.
	// Both checks are done in constant time.
	if (!timingSafeEqual(provided.user, 'admin')) return false;
	return timingSafeEqual(provided.pass, expected);
}

/**
 * Build the 401 response that triggers the browser's Basic Auth prompt.
 * Realm carries the tenant name so the prompt is contextual.
 */
export function unauthorizedResponse(tenant: TenantConfig): Response {
	return new Response('Authentication required', {
		status: 401,
		headers: {
			'WWW-Authenticate': `Basic realm="${tenant.name} admin", charset="UTF-8"`
		}
	});
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
}

// Cookies unused for now but the parameter kept on the interface in
// case we add an opt-in remember-me cookie later. Suppresses unused
// warnings without changing the public API.
export type _Cookies = Cookies;

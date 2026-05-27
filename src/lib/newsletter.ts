/**
 * Newsletter signup — posts straight to a Google Form whose
 * responses are linked to a Google Sheet.
 *
 * Why a Google Form and not the Sheets API directly:
 *  - no service account / API key / OAuth setup
 *  - no backend endpoint needed; the form accepts cross-origin POSTs
 *  - swapping to a real ESP (MailerLite, ConvertKit) later only
 *    requires changing this module — call site stays the same.
 *
 * `mode: 'no-cors'` is mandatory: Google's response doesn't include
 * CORS headers, but the POST itself still reaches the form and the
 * row lands in the linked Sheet. The opaque response means we can't
 * distinguish "saved" from "Google rejected" client-side — for v1
 * that's a tradeoff we accept. Server-side validation can be added
 * later via a Vercel function in front of this if needed.
 */

// Dynamic public env: missing vars => no-op (logged), not a build failure.
// peptora-shop is multi-tenant and the newsletter endpoint is platform-wide,
// so tenants without env vars set still get a clean build.
import { env } from '$env/dynamic/public';

export async function subscribe(email: string): Promise<{ ok: boolean; reason?: string }> {
	const trimmed = email.trim();
	if (!trimmed) return { ok: false, reason: 'Email is required.' };
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
		return { ok: false, reason: "That doesn't look like a valid email." };
	}
	if (!env.PUBLIC_NEWSLETTER_FORM_ENDPOINT || !env.PUBLIC_NEWSLETTER_EMAIL_FIELD) {
		// During local dev before the Form is wired up.
		console.warn('Newsletter endpoint not configured; subscribe() is a no-op.');
		return { ok: true };
	}
	const fd = new FormData();
	fd.append(env.PUBLIC_NEWSLETTER_EMAIL_FIELD, trimmed);
	try {
		await fetch(env.PUBLIC_NEWSLETTER_FORM_ENDPOINT, {
			method: 'POST',
			mode: 'no-cors',
			body: fd
		});
		return { ok: true };
	} catch (e) {
		return { ok: false, reason: 'Could not reach the signup server. Try again later.' };
	}
}

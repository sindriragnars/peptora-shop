import { fail } from '@sveltejs/kit';
import { createSignup, isSlugTaken, type SignupCreateInput } from '$lib/signups';
import { sendSignupNotificationToAdmin } from '$lib/email';
import { getSignup } from '$lib/signups';
import { listTenants } from '$lib/tenants';
import type { Actions } from './$types';

/**
 * Public signup form — POST handler.
 *
 * Validates the form, persists the application to Redis, fires a
 * notification email to the platform admin (best-effort), and returns
 * a success flag the page renders into a confirmation panel.
 *
 * Tenant materialisation (writing content/tenants/<slug>/tenant.json
 * + Decap collection) is deferred: the admin reviews the application
 * at /admin/signups, clicks Approve, then runs the existing git
 * workflow manually. Auto-create lands in Phase 7.5 once volume
 * justifies the GitHub API plumbing.
 */

const RESERVED_SLUGS = new Set([
	'www',
	'app',
	'shop',
	'sell',
	'admin',
	'api',
	'_app',
	'peptora-push',
	'peptora-cms-oauth',
	'static',
	'public',
	'tenants',
	'demo',
	'acme'
]);

const SLUG_RE = /^[a-z][a-z0-9-]{1,29}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

interface FormErrors {
	slug?: string;
	name?: string;
	ownerName?: string;
	email?: string;
	phone?: string;
	address?: string;
	brandColor?: string;
	flatRateISK?: string;
	freeShippingISK?: string;
	description?: string;
}

export const actions: Actions = {
	default: async ({ request }) => {
		const data = await request.formData();
		const values: Record<string, string> = {};
		for (const [k, v] of data.entries()) values[k] = String(v);

		const errors: FormErrors = {};

		const slug = (values.slug ?? '').trim().toLowerCase();
		if (!SLUG_RE.test(slug))
			errors.slug = 'Slug verður að byrja á staf og vera 2–30 stafir (lowercase, tölur og bandstrik leyfð).';
		else if (RESERVED_SLUGS.has(slug)) errors.slug = `Slug "${slug}" er frátekið.`;
		else {
			const existingSlugs = listTenants().map((t) => t.slug);
			if (await isSlugTaken(slug, existingSlugs)) errors.slug = `Slug "${slug}" er nú þegar í notkun.`;
		}

		const name = (values.name ?? '').trim();
		if (name.length < 1 || name.length > 80) errors.name = 'Nafn verður að vera 1–80 stafir.';

		const ownerName = (values.ownerName ?? '').trim();
		if (ownerName.length < 1) errors.ownerName = 'Nafn er nauðsynlegt.';

		const email = (values.email ?? '').trim();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Ógilt netfang.';

		const phone = (values.phone ?? '').trim() || undefined;
		const address = (values.address ?? '').trim() || undefined;

		const brandColor = (values.brandColor ?? '').trim();
		if (!HEX_RE.test(brandColor)) errors.brandColor = 'Litur verður að vera á forminu #RRGGBB.';

		const flatRateISK = Number(values.flatRateISK);
		if (!Number.isFinite(flatRateISK) || flatRateISK < 0 || flatRateISK > 100000)
			errors.flatRateISK = 'Sendingargjald verður að vera tala milli 0 og 100.000.';

		const freeShippingISK = Number(values.freeShippingISK);
		if (!Number.isFinite(freeShippingISK) || freeShippingISK < 0 || freeShippingISK > 1000000)
			errors.freeShippingISK = 'Þröskuldur fyrir fría sendingu verður að vera tala 0–1.000.000.';

		const description = (values.description ?? '').trim();
		if (description.length < 10) errors.description = 'Lýsing verður að vera að minnsta kosti 10 stafir.';
		if (description.length > 1000) errors.description = 'Lýsing er of löng (max 1000 stafir).';

		if (Object.keys(errors).length > 0) {
			return fail(400, { errors, values });
		}

		const input: SignupCreateInput = {
			slug,
			name,
			ownerName,
			email,
			phone,
			address,
			brandColor,
			flatRateISK: Math.round(flatRateISK),
			freeShippingISK: Math.round(freeShippingISK),
			description
		};
		const id = await createSignup(input);

		// Best-effort: surface to platform admin. Failure here doesn't
		// block the user — they get the success page either way; the
		// application is in the queue at /admin/signups regardless.
		const app = await getSignup(id);
		if (app) await sendSignupNotificationToAdmin({ application: app });

		return { success: true, slug };
	}
};

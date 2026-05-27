import { fail } from '@sveltejs/kit';
import { listSignups, updateSignupStatus, getSignup } from '$lib/signups';
import { sendSignupApprovalEmail } from '$lib/email';
import type { Actions, PageServerLoad } from './$types';

/**
 * Platform-admin queue for shop signup applications.
 *
 * MVP: Approving an application marks it approved in Redis and sends
 * a notification email to the applicant. The platform admin still has
 * to materialise the tenant manually (`cp content/tenants/demo
 * content/tenants/<slug>` + edit tenant.json + commit + push) using
 * the brand colour, contact info, and shipping settings shown in the
 * row. Auto-create via the GitHub API lands in Phase 7.5.
 */

export const load: PageServerLoad = async () => {
	const all = await listSignups();
	const pending = all.filter((a) => a.status === 'pending');
	const processed = all.filter((a) => a.status !== 'pending');
	return { pending, processed };
};

export const actions: Actions = {
	approve: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		if (!id) return fail(400, { error: 'id required' });
		const updated = await updateSignupStatus(id, 'approved');
		if (!updated) return fail(404, { error: 'signup not found' });
		await sendSignupApprovalEmail({ application: updated });
		return { ok: true, action: 'approved', id };
	},
	reject: async ({ request }) => {
		const data = await request.formData();
		const id = String(data.get('id') ?? '');
		const reason = String(data.get('reason') ?? '').trim() || undefined;
		if (!id) return fail(400, { error: 'id required' });
		const updated = await updateSignupStatus(id, 'rejected', reason);
		if (!updated) return fail(404, { error: 'signup not found' });
		return { ok: true, action: 'rejected', id };
	}
};

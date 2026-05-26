import { error, fail } from '@sveltejs/kit';
import { getOrder, updateOrder } from '$lib/orders';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const order = await getOrder(params.id);
	if (!order || order.tenantSlug !== params.slug) {
		error(404, 'Order not found');
	}
	return { order };
};

export const actions: Actions = {
	/**
	 * Mark a paid order as fulfilled (i.e. the tenant has shipped it).
	 * Idempotent — re-firing on an already-fulfilled order is a no-op.
	 * Auth is enforced by the parent admin +layout.server.ts; we don't
	 * re-check here because actions inherit the layout guards.
	 */
	fulfill: async ({ params }) => {
		const order = await getOrder(params.id);
		if (!order || order.tenantSlug !== params.slug) {
			return fail(404, { error: 'Order not found' });
		}
		if (order.status !== 'paid') {
			return fail(400, { error: `Cannot fulfill order in status ${order.status}` });
		}
		await updateOrder(params.id, { status: 'fulfilled' });
		return { success: true };
	}
};

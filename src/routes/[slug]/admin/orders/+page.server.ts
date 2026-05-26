import { listOrders } from '$lib/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const filter = url.searchParams.get('status'); // null → all

	const all = await listOrders(params.slug, 200);
	const orders = filter ? all.filter((o) => o.status === filter) : all;

	// Counts per status so the filter tabs show how many are in each
	// bucket without re-loading the full set client-side.
	const counts = {
		all: all.length,
		pending: all.filter((o) => o.status === 'pending').length,
		paid: all.filter((o) => o.status === 'paid').length,
		fulfilled: all.filter((o) => o.status === 'fulfilled').length,
		cancelled: all.filter((o) => o.status === 'cancelled').length,
		failed: all.filter((o) => o.status === 'failed').length
	};

	return { orders, counts, filter };
};

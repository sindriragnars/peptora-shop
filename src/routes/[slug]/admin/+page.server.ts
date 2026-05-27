import { listOrders, type Order } from '$lib/orders';
import { listProducts } from '$lib/products.server';
import type { PageServerLoad } from './$types';

/**
 * Tenant admin dashboard.
 *
 * Pulls the full order list + product catalog and derives operator-
 * facing stats: counts per status, revenue windows, recent activity,
 * low-stock callouts. Counts on revenue use `paid` and `fulfilled`
 * only — pending/failed/expired never represent money in hand.
 *
 * Caches nothing on purpose: the dashboard is rarely loaded and we
 * want the freshest numbers. Bumps to a Redis pipeline can come later
 * if order volume grows past a few hundred per tenant.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isRevenueOrder(o: Order): boolean {
	return o.status === 'paid' || o.status === 'fulfilled';
}

export const load: PageServerLoad = async ({ params }) => {
	const [orders, products] = await Promise.all([
		listOrders(params.slug, 200),
		Promise.resolve(listProducts(params.slug))
	]);

	const now = Date.now();
	const dayAgo = now - ONE_DAY_MS;
	const weekAgo = now - 7 * ONE_DAY_MS;
	const monthAgo = now - 30 * ONE_DAY_MS;

	const counts = {
		all: orders.length,
		pending: orders.filter((o) => o.status === 'pending').length,
		paid: orders.filter((o) => o.status === 'paid').length,
		fulfilled: orders.filter((o) => o.status === 'fulfilled').length,
		cancelled: orders.filter((o) => o.status === 'cancelled').length,
		failed: orders.filter((o) => o.status === 'failed').length
	};

	// Revenue rolls up paid+fulfilled orders within each window.
	function revenueSince(cutoffMs: number): number {
		return orders
			.filter(isRevenueOrder)
			.filter((o) => o.createdAt >= cutoffMs)
			.reduce((sum, o) => sum + o.totalISK, 0);
	}
	const revenue = {
		today: revenueSince(dayAgo),
		week: revenueSince(weekAgo),
		month: revenueSince(monthAgo),
		allTime: orders.filter(isRevenueOrder).reduce((s, o) => s + o.totalISK, 0)
	};

	// Top 5 recent orders for the at-a-glance table.
	const recentOrders = orders.slice(0, 5).map((o) => ({
		id: o.id,
		createdAt: o.createdAt,
		status: o.status,
		totalISK: o.totalISK,
		customerName: o.customer.name,
		itemCount: o.items.reduce((n, i) => n + i.qty, 0)
	}));

	// Low/out-of-stock callout — these need operator action.
	const lowStock = products
		.filter((p) => p.stock !== 'in-stock')
		.map((p) => ({ id: p.id, title: p.title, stock: p.stock }));

	return {
		counts,
		revenue,
		recentOrders,
		lowStock,
		productCount: products.length
	};
};

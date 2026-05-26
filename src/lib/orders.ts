/**
 * Order persistence in Upstash Redis. Reuses the peptora-push Redis
 * instance via Vercel marketplace integration env vars — same pattern
 * as peptora-push's lib/redis.ts.
 *
 * Keyspace:
 *   shop:order:<orderId>       → JSON of full Order (1-year TTL)
 *   shop:orders:<tenantSlug>   → sorted set of orderIds, scored by createdAt
 *
 * Server-only. UI never reaches Redis directly.
 */
import { Redis } from '@upstash/redis';

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export type OrderStatus =
	| 'pending'
	| 'paid'
	| 'fulfilled'
	| 'failed'
	| 'expired'
	| 'cancelled';

export interface OrderItem {
	productId: string;
	title: string; // snapshot at order time
	priceISK: number; // snapshot — protects against later catalog price edits
	qty: number;
	lineTotalISK: number;
}

export interface OrderCustomer {
	name: string;
	email: string;
	phone: string;
	address: string;
	postalCode: string;
	city: string;
	notes?: string;
}

export interface Order {
	id: string;
	tenantSlug: string;
	status: OrderStatus;
	customer: OrderCustomer;
	items: OrderItem[];
	shipping: {
		option: string;
		costISK: number;
	};
	subtotalISK: number;
	totalISK: number;
	currency: 'ISK' | 'EUR';
	revolut: {
		orderId: string;
		publicId: string;
		checkoutUrl: string;
	};
	createdAt: number; // unix ms
	paidAt?: number;
}

let _redis: Redis | null = null;

function redis(): Redis {
	if (_redis) return _redis;
	// Vercel-Upstash binding env var convention. peptora-push had to use
	// a fallback chain because of a typo prefix; if peptora-shop's Redis
	// is freshly provisioned in this project the standard names will work.
	const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
	if (!url || !token) {
		throw new Error(
			'Missing Upstash Redis env vars. Expect KV_REST_API_URL/TOKEN or UPSTASH_REDIS_REST_URL/TOKEN.'
		);
	}
	_redis = new Redis({ url, token });
	return _redis;
}

export const ORDER_KEY = (id: string) => `shop:order:${id}`;
export const ORDERS_INDEX = (slug: string) => `shop:orders:${slug}`;

/**
 * Save a freshly-created order. Writes the JSON + adds to the per-tenant
 * sorted-set index. Both in one pipeline so partial-failure can't strand
 * an order out of the index.
 */
export async function saveOrder(order: Order): Promise<void> {
	const r = redis();
	const pipe = r.pipeline();
	pipe.set(ORDER_KEY(order.id), JSON.stringify(order), { ex: ONE_YEAR_SECONDS });
	pipe.zadd(ORDERS_INDEX(order.tenantSlug), { score: order.createdAt, member: order.id });
	await pipe.exec();
}

/**
 * Patch an existing order. Common path: webhook updates status to 'paid'
 * + sets paidAt. Returns the updated order, or null if not found.
 */
export async function updateOrder(id: string, patch: Partial<Order>): Promise<Order | null> {
	const r = redis();
	const raw = await r.get<string>(ORDER_KEY(id));
	if (!raw) return null;
	const current: Order = typeof raw === 'string' ? JSON.parse(raw) : (raw as Order);
	const updated: Order = { ...current, ...patch };
	await r.set(ORDER_KEY(id), JSON.stringify(updated), { ex: ONE_YEAR_SECONDS });
	return updated;
}

export async function getOrder(id: string): Promise<Order | null> {
	const r = redis();
	const raw = await r.get<string>(ORDER_KEY(id));
	if (!raw) return null;
	return typeof raw === 'string' ? JSON.parse(raw) : (raw as Order);
}

/**
 * List a tenant's orders, newest first. Pagination uses the sorted-set
 * indexes — Phase 4 admin dashboard consumes this.
 */
export async function listOrders(tenantSlug: string, limit = 50): Promise<Order[]> {
	const r = redis();
	const ids = await r.zrange<string[]>(ORDERS_INDEX(tenantSlug), 0, limit - 1, { rev: true });
	if (ids.length === 0) return [];
	const raws = await r.mget<(string | null)[]>(...ids.map(ORDER_KEY));
	return raws
		.map((raw) => (typeof raw === 'string' ? (JSON.parse(raw) as Order) : (raw as Order | null)))
		.filter((o): o is Order => o !== null);
}

/**
 * Look up an order by the Revolut order id. Webhook receives only the
 * Revolut id, not our internal id, so we need this lookup to mutate the
 * right row. For a small per-tenant order volume a linear scan over
 * recent orders is fine — at scale (>10k orders) we'd add a separate
 * lookup index.
 */
export async function findByRevolutOrderId(
	tenantSlug: string,
	revolutOrderId: string
): Promise<Order | null> {
	const orders = await listOrders(tenantSlug, 200);
	return orders.find((o) => o.revolut.orderId === revolutOrderId) ?? null;
}

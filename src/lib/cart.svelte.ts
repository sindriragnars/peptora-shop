/**
 * Reactive cart store, one instance per tenant slug.
 *
 * Wraps Dexie reads/writes and exposes a `$state`-backed `items` array so
 * Svelte components can use the store directly. IndexedDB is the source
 * of truth; the in-memory array is a cache that the store keeps in sync
 * after every mutation.
 *
 * Browser-only: `new CartStore(slug)` opens an IndexedDB connection on
 * construction, so callers must initialize lazily (on mount) and skip
 * on the server. {@link getCartStore} handles that for you.
 */
import { browser } from '$app/environment';
import { shopDB, type CartItem } from './db';

class CartStore {
	readonly tenantSlug: string;
	items = $state<CartItem[]>([]);
	loaded = $state(false);

	constructor(tenantSlug: string) {
		this.tenantSlug = tenantSlug;
		void this.reload();
	}

	/** Pull current rows from IndexedDB into the reactive array. */
	private async reload() {
		const rows = await shopDB(this.tenantSlug).cart.orderBy('addedAt').toArray();
		this.items = rows;
		this.loaded = true;
	}

	/** Total quantity across all line items — useful for the header badge. */
	get count(): number {
		return this.items.reduce((sum, it) => sum + it.qty, 0);
	}

	get isEmpty(): boolean {
		return this.loaded && this.items.length === 0;
	}

	/**
	 * Add a product (or bump its quantity). Re-pulls from IndexedDB so the
	 * reactive array reflects the canonical row including auto-id.
	 */
	async add(productId: string, qty = 1): Promise<void> {
		const db = shopDB(this.tenantSlug);
		const existing = await db.cart.where('productId').equals(productId).first();
		if (existing) {
			await db.cart.update(existing.id!, { qty: existing.qty + qty });
		} else {
			await db.cart.add({ productId, qty, addedAt: Date.now() });
		}
		await this.reload();
	}

	async setQty(productId: string, qty: number): Promise<void> {
		const db = shopDB(this.tenantSlug);
		const existing = await db.cart.where('productId').equals(productId).first();
		if (!existing) return;
		if (qty <= 0) {
			await db.cart.delete(existing.id!);
		} else {
			await db.cart.update(existing.id!, { qty });
		}
		await this.reload();
	}

	async remove(productId: string): Promise<void> {
		await this.setQty(productId, 0);
	}

	async clear(): Promise<void> {
		await shopDB(this.tenantSlug).cart.clear();
		await this.reload();
	}
}

const stores = new Map<string, CartStore>();

/**
 * Get (or lazily create) the cart store for a tenant slug. Returns a
 * stub-empty store on the server so components can render without
 * crashing during SSR — items[] stays empty until client hydration
 * opens IndexedDB.
 */
export function getCartStore(tenantSlug: string): CartStore {
	if (!browser) {
		// Return a fresh empty stub each call on the server — it's never
		// shared across requests and never touches IndexedDB.
		return { items: [], loaded: false, count: 0, isEmpty: false } as unknown as CartStore;
	}
	let store = stores.get(tenantSlug);
	if (!store) {
		store = new CartStore(tenantSlug);
		stores.set(tenantSlug, store);
	}
	return store;
}

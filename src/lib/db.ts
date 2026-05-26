/**
 * Per-tenant IndexedDB cart storage via Dexie.
 *
 * One database per tenant slug (`peptora-shop-<slug>`) so a user with
 * carts open in two storefronts at once doesn't get them merged. Same
 * pattern peptora-webapp uses for reminders + dose logs.
 *
 * SSR-safe: this module is import-safe on the server (Dexie defers any
 * IndexedDB access until you actually open a database), but callers
 * MUST guard `new ShopDB(slug)` with a browser check — see cart.svelte.ts.
 */
import Dexie, { type EntityTable } from 'dexie';

export interface CartItem {
	/** Auto-increment primary key */
	id?: number;
	productId: string;
	qty: number;
	addedAt: number;
}

export class ShopDB extends Dexie {
	cart!: EntityTable<CartItem, 'id'>;

	constructor(tenantSlug: string) {
		super(`peptora-shop-${tenantSlug}`);
		this.version(1).stores({
			// productId is unique per cart so qty changes update the same row
			// instead of creating duplicates. Compound key would be overkill at
			// this scale — productId by itself works.
			cart: '++id, &productId, addedAt'
		});
	}
}

const cache = new Map<string, ShopDB>();

/** Lazy per-tenant DB factory. Cached so we don't reopen connections. */
export function shopDB(tenantSlug: string): ShopDB {
	let db = cache.get(tenantSlug);
	if (!db) {
		db = new ShopDB(tenantSlug);
		cache.set(tenantSlug, db);
	}
	return db;
}

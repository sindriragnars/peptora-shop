/**
 * IndexedDB schema. Single Dexie database backing all of v0.3+:
 *   - dose_logs: history of doses the user marked as taken
 *   - reminders: scheduled doses (UI lands in v0.3, push fires in v0.4)
 *
 * Local-only. No sync, no cloud — same trust model as the Android app.
 * Reset by deleting the app's site data in browser settings.
 */
import Dexie, { type Table } from 'dexie';

export interface DoseLog {
	id?: number;
	peptideId: string;
	dose: string; // free-text — matches what the user typed/saw on the peptide page
	takenAt: number; // epoch ms
	note?: string;
}

export interface Reminder {
	id?: number;
	peptideId: string;
	dose: string;
	time: string; // "HH:MM" 24-hour
	/** Days of week the reminder fires on. 0 = Sunday … 6 = Saturday. */
	days: number[];
	enabled: boolean;
	createdAt: number;
	/** Protocol start (epoch ms). Defaults to createdAt on legacy rows. */
	startsAt?: number;
	/** Protocol end (epoch ms). Undefined = open-ended. */
	endsAt?: number;
}

/** A physical vial the user owns. Unmixed while `bacMl`/`mixedAt` are unset. */
export interface Vial {
	id?: number;
	peptideId: string;
	/** Peptide content of the vial, mg. */
	vialMg: number;
	/** How many identical vials in this state. Unset = 1 (legacy rows).
	 *  Only meaningful while unmixed — mixing splits one off into its own
	 *  row so each mixed vial keeps its own expiry and remaining. */
	qty?: number;
	/** Bacteriostatic water added, mL. Unset = still dry powder. */
	bacMl?: number;
	/** When it was reconstituted (epoch ms). Unset = still dry powder. */
	mixedAt?: number;
	createdAt: number;
}

class PeptoraDB extends Dexie {
	dose_logs!: Table<DoseLog, number>;
	reminders!: Table<Reminder, number>;
	vials!: Table<Vial, number>;

	constructor() {
		super('peptora');
		this.version(1).stores({
			// `takenAt` indexed so date-range queries (heatmap, recent doses)
			// don't have to scan the table.
			dose_logs: '++id, peptideId, takenAt',
			reminders: '++id, peptideId, enabled'
		});
		// v2: swap `enabled` (boolean — IndexedDB can't index booleans
		// usefully and we never .where() on it) for `createdAt`, which
		// allReminders() needs for orderBy(). Existing v1 reminders
		// auto-migrate.
		this.version(2).stores({
			reminders: '++id, peptideId, createdAt'
		});
		// v3: add startsAt + endsAt for protocol support. New fields are
		// optional, so prior rows stay readable without a data migration.
		this.version(3).stores({
			reminders: '++id, peptideId, createdAt'
		});
		// v4: vial inventory. `createdAt` indexed for the list ordering;
		// `peptideId` for matching dose logs back to the vial they came from.
		this.version(4).stores({
			vials: '++id, peptideId, createdAt'
		});
	}
}

// Single shared instance. Constructed only in the browser — guard
// against SSR (Vite + SvelteKit do server-side bundling for
// prerendering, and Dexie touches `indexedDB` on import).
let _db: PeptoraDB | undefined;
export function db(): PeptoraDB {
	if (typeof window === 'undefined') {
		// Returning a fake here is risky — better to throw so callers
		// know they ran in the wrong environment.
		throw new Error('db() called on server. Wrap calls in $effect or onMount.');
	}
	if (!_db) _db = new PeptoraDB();
	return _db;
}

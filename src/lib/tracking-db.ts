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
}

class PeptoraDB extends Dexie {
	dose_logs!: Table<DoseLog, number>;
	reminders!: Table<Reminder, number>;

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

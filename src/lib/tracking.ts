/**
 * Dose-log queries and derived stats. Pure data — UI lives in
 * /routes/doses/+page.svelte.
 */
import { db, type DoseLog } from './tracking-db';

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
	const c = new Date(d);
	c.setHours(0, 0, 0, 0);
	return c;
}

function dayKey(d: Date | number): string {
	const x = startOfDay(typeof d === 'number' ? new Date(d) : d);
	return x.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Add a new dose log. Returns the inserted record's id. */
export async function logDose(input: Omit<DoseLog, 'id' | 'takenAt'> & { takenAt?: number }) {
	const takenAt = input.takenAt ?? Date.now();
	return db().dose_logs.add({ ...input, takenAt });
}

export async function deleteLog(id: number) {
	return db().dose_logs.delete(id);
}

/** Correct a logged dose. `note` is left alone — nothing writes one yet. */
export async function updateLog(
	id: number,
	changes: Partial<Pick<DoseLog, 'peptideId' | 'dose' | 'takenAt' | 'vialId' | 'units' | 'mg'>>
) {
	return db().dose_logs.update(id, changes);
}

/** All logs, newest first. */
export async function allLogs(): Promise<DoseLog[]> {
	return db().dose_logs.orderBy('takenAt').reverse().toArray();
}

/** Most recent N logs. */
export async function recentDoses(limit = 5): Promise<DoseLog[]> {
	return db().dose_logs.orderBy('takenAt').reverse().limit(limit).toArray();
}

/** All logs for a given calendar day (YYYY-MM-DD, local time). Newest first. */
export async function dosesOnDay(date: string): Promise<DoseLog[]> {
	const start = new Date(date + 'T00:00:00').getTime();
	const end = start + DAY_MS;
	return db()
		.dose_logs.where('takenAt')
		.between(start, end, true, false)
		.reverse()
		.sortBy('takenAt');
}

export interface HeatmapCell {
	date: string; // YYYY-MM-DD
	count: number;
}

/**
 * Returns a row-major array of cells covering the last `weeks` weeks
 * ending today, oldest first. The UI renders this as a 7-column grid;
 * `weeks * 7` cells total.
 */
export async function heatmap(weeks = 5): Promise<HeatmapCell[]> {
	const days = weeks * 7;
	const today = startOfDay(new Date());
	const startMs = today.getTime() - (days - 1) * DAY_MS;

	const logs = await db().dose_logs
		.where('takenAt')
		.aboveOrEqual(startMs)
		.toArray();

	const buckets = new Map<string, number>();
	for (const log of logs) {
		const k = dayKey(log.takenAt);
		buckets.set(k, (buckets.get(k) ?? 0) + 1);
	}

	const cells: HeatmapCell[] = [];
	for (let i = 0; i < days; i++) {
		const d = new Date(startMs + i * DAY_MS);
		const k = dayKey(d);
		cells.push({ date: k, count: buckets.get(k) ?? 0 });
	}
	return cells;
}

/**
 * Consecutive days ending today (or yesterday, if no dose has been
 * logged yet today) that have at least one dose log. 0 if no streak.
 */
export async function dayStreak(): Promise<number> {
	const dates = new Set<string>();
	const logs = await db().dose_logs.toArray();
	for (const log of logs) dates.add(dayKey(log.takenAt));

	let streak = 0;
	let cursor = startOfDay(new Date());

	// If today has no log, allow the streak to start at yesterday
	// instead of forcing a break the instant the user opens the app.
	if (!dates.has(dayKey(cursor))) {
		cursor = new Date(cursor.getTime() - DAY_MS);
	}

	// Safety cap — no realistic user is going to stack-dose for ten years.
	for (let i = 0; i < 3650; i++) {
		if (!dates.has(dayKey(cursor))) break;
		streak++;
		cursor = new Date(cursor.getTime() - DAY_MS);
	}
	return streak;
}

/** Count of logs in the current calendar month. */
export async function dosesThisMonth(): Promise<number> {
	const now = new Date();
	const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
	return db().dose_logs.where('takenAt').aboveOrEqual(monthStart).count();
}

/**
 * Peptide id with the most logs in the given window (default 30 days).
 * Returns null if there are no logs in that window.
 */
export async function mostTaken(days = 30): Promise<string | null> {
	const cutoff = Date.now() - days * DAY_MS;
	const logs = await db().dose_logs.where('takenAt').aboveOrEqual(cutoff).toArray();
	if (logs.length === 0) return null;

	const counts = new Map<string, number>();
	for (const log of logs) {
		counts.set(log.peptideId, (counts.get(log.peptideId) ?? 0) + 1);
	}
	let topId: string | null = null;
	let topCount = 0;
	for (const [id, n] of counts) {
		if (n > topCount) {
			topCount = n;
			topId = id;
		}
	}
	return topId;
}

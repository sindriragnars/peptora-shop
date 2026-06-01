/**
 * Reminder CRUD. Reminders live in IndexedDB as the local source
 * of truth. After every write we mirror the full reminder list to
 * the peptora-push backend so QStash can fire actual notifications
 * at the scheduled times (v0.5 Phase B). Sync is best-effort —
 * a failed POST never blocks the local write.
 */
import { db, type Reminder } from './tracking-db';
import { getPeptide } from './peptides';
import { getStoredSubId, isPushConfigured } from './push';
import { inferSchedule } from './scheduling';
import { env } from '$env/dynamic/public';

export async function addReminder(input: Omit<Reminder, 'id' | 'createdAt'>) {
	const id = await db().reminders.add({ ...input, createdAt: Date.now() });
	void syncRemindersToBackend();
	return id;
}

export async function updateReminder(id: number, patch: Partial<Reminder>) {
	const result = await db().reminders.update(id, patch);
	void syncRemindersToBackend();
	return result;
}

export async function deleteReminder(id: number) {
	const result = await db().reminders.delete(id);
	void syncRemindersToBackend();
	return result;
}

/** All reminders, newest first. */
export async function allReminders(): Promise<Reminder[]> {
	return db().reminders.orderBy('createdAt').reverse().toArray();
}

/**
 * Push the current full reminder list to peptora-push so QStash
 * can schedule notifications. Fire-and-forget — failures are logged
 * but never bubble up, since the local CRUD already succeeded.
 *
 * Also exported (as `syncRemindersToBackend`) so the Settings page
 * can trigger a one-time sync right after the user enables push,
 * mopping up any reminders saved before they had a subscription.
 *
 * No-op when push isn't configured or when there's no active
 * subscription.
 */
export { syncRemindersToBackend };

async function syncRemindersToBackend(): Promise<void> {
	if (!isPushConfigured()) return;
	const subId = getStoredSubId();
	if (!subId) return;
	try {
		const all = await allReminders();
		const now = Date.now();
		// Sync only enabled reminders still inside their protocol window.
		// Disabled or expired reminders stay local — skipping expired here
		// means we don't need backend changes to stop firing past endsAt.
		const active = all.filter((r) => {
			if (!r.enabled) return false;
			if (r.endsAt && r.endsAt <= now) return false;
			return true;
		});
		const payload = active.map((r) => {
			const peptide = getPeptide(r.peptideId, 'en');
			return {
				id: r.id ?? 0,
				peptideId: r.peptideId,
				peptideName: peptide?.name ?? r.peptideId,
				dose: r.dose,
				time: r.time,
				days: r.days,
				startsAt: r.startsAt,
				endsAt: r.endsAt
			};
		});
		await fetch(`${env.PUBLIC_PUSH_API_URL}/api/sync-reminders`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: subId, reminders: payload })
		});
	} catch (e) {
		console.warn('reminder sync to backend failed', e);
	}
}

/**
 * Bulk-create reminders for every peptide in a stack the user has
 * just decided to start. One row per (peptide × inferred time) so a
 * 2x-daily peptide produces two rows. Returns the total count
 * created so the caller can show a confirmation toast.
 */
export async function createRemindersFromStack(
	items: Array<{ peptideId: string; dose: string; frequency: string }>
): Promise<number> {
	const now = Date.now();
	const rows: Omit<Reminder, 'id'>[] = [];
	for (const item of items) {
		const { times, days } = inferSchedule(item.frequency);
		for (const t of times) {
			rows.push({
				peptideId: item.peptideId,
				dose: item.dose,
				time: t,
				days: [...days],
				enabled: true,
				createdAt: now
			});
		}
	}
	if (rows.length === 0) return 0;
	await db().reminders.bulkAdd(rows);
	return rows.length;
}

/**
 * Compact human-readable summary of which days a reminder fires.
 * "Daily", "Mon-Fri", "Tue Thu Sat", or "—" if no days selected.
 */
export function describeDays(days: number[]): string {
	if (days.length === 0) return '—';
	if (days.length === 7) return 'Daily';
	const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const sorted = [...days].sort((a, b) => a - b);
	// Detect Mon-Fri shorthand.
	if (sorted.join(',') === '1,2,3,4,5') return 'Weekdays';
	if (sorted.join(',') === '0,6') return 'Weekends';
	return sorted.map((d) => labels[d]).join(' ');
}

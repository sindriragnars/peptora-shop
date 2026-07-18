/**
 * Vial inventory — what the user owns and how each vial is mixed.
 *
 * "Remaining" is derived, not stored: we sum the dose logs for that peptide
 * since the vial was mixed. That keeps the logging flow untouched (no vial
 * picker on every entry) at the cost of being approximate when two vials of
 * the same peptide are open at once.
 */
import { db, type BacBottle, type DoseLog, type Vial } from './tracking-db';
import { parseDoseToMg } from './calculator';

/** Reconstituted peptide keeps roughly 28 days refrigerated. */
export const MIXED_SHELF_LIFE_DAYS = 28;
const DAY_MS = 86_400_000;

export interface VialRow extends Vial {
	/** mg drawn since the vial was mixed, summed from dose logs. */
	usedMg: number;
}

/**
 * mg one dose log removed from a given vial.
 *
 * A log that names its vial (`vialId`) counts only against that vial, using
 * the exact mg stored at log time. A legacy free-text log has neither, so it
 * falls back to the old heuristic — matched to any mixed vial of the same
 * peptide by date, with mg parsed from the text. That legacy path stays
 * approximate when two vials of one peptide overlap; new logs are exact.
 */
function drawnFromVial(l: DoseLog, v: VialRow | Vial): number {
	if (l.vialId != null) return l.vialId === v.id ? (l.mg ?? 0) : 0;
	return v.mixedAt && l.peptideId === v.peptideId && l.takenAt >= v.mixedAt
		? (parseDoseToMg(l.dose) ?? 0)
		: 0;
}

export const concentrationMgMl = (v: Vial): number | null =>
	v.bacMl && v.bacMl > 0 ? v.vialMg / v.bacMl : null;

export const expiresAt = (v: Vial): number | null =>
	v.mixedAt ? v.mixedAt + MIXED_SHELF_LIFE_DAYS * DAY_MS : null;

/** Vials newest first, each with the mg already drawn from it. */
export async function allVials(): Promise<VialRow[]> {
	const vials = await db().vials.orderBy('createdAt').reverse().toArray();
	if (vials.length === 0) return [];
	// One pass over the logs beats a query per vial at this scale.
	const logs = await db().dose_logs.toArray();
	return vials.map((v) => ({
		...v,
		usedMg: v.mixedAt ? logs.reduce((sum, l) => sum + drawnFromVial(l, v), 0) : 0
	}));
}

export async function addVial(
	peptideId: string,
	vialMg: number,
	bacMl?: number,
	qty = 1
): Promise<void> {
	const now = Date.now();
	const count = Math.max(1, Math.round(qty));

	// Unmixed vials of the same peptide and size are interchangeable, so they
	// belong on one counted row however you added them — three at once or one
	// at a time. A mixed vial always gets its own row: it owns a mix date,
	// strength and expiry that can't be shared.
	if (!(bacMl && bacMl > 0)) {
		const stack = await findDryStack(peptideId, vialMg);
		if (stack) {
			await db().vials.update(stack.id!, { qty: (stack.qty ?? 1) + count });
			return;
		}
	}

	await db().vials.add({
		peptideId,
		vialMg,
		qty: count,
		...(bacMl && bacMl > 0 ? { bacMl, mixedAt: now } : {}),
		createdAt: now
	});
}

const findDryStack = async (peptideId: string, vialMg: number): Promise<Vial | undefined> =>
	(await db().vials.toArray()).find(
		(v) => !v.mixedAt && v.peptideId === peptideId && v.vialMg === vialMg
	);

/**
 * Fold duplicate dry stacks into one row.
 *
 * Vials added one at a time used to each get their own row, so the same
 * powder could sit in the list several times over. Run on load and after
 * every change, so a row edited to match another merges too. Idempotent —
 * a no-op once every peptide/size pair is unique.
 */
export async function consolidateDryVials(): Promise<void> {
	const dry = (await db().vials.toArray()).filter((v) => !v.mixedAt);
	const groups = new Map<string, Vial[]>();
	for (const v of dry) {
		const key = `${v.peptideId}|${v.vialMg}`;
		groups.set(key, [...(groups.get(key) ?? []), v]);
	}
	for (const rows of groups.values()) {
		if (rows.length < 2) continue;
		// Keep the oldest row so the stack's createdAt stays truthful — it's
		// what orders the list and what BAC bottles are matched against.
		const [keep, ...rest] = [...rows].sort((a, b) => a.createdAt - b.createdAt);
		const total = rows.reduce((sum, v) => sum + (v.qty ?? 1), 0);
		await db().vials.update(keep.id!, { qty: total });
		await db().vials.bulkDelete(rest.map((v) => v.id!));
	}
}

/**
 * Mix a single vial. When the row holds several unopened vials, one is split
 * off into its own row — each mixed vial needs its own expiry and remaining,
 * so they can't stay grouped.
 */
export async function mixOne(v: Vial, bacMl: number): Promise<void> {
	const now = Date.now();
	const qty = v.qty ?? 1;
	if (qty > 1) {
		await db().vials.update(v.id!, { qty: qty - 1 });
		await db().vials.add({
			peptideId: v.peptideId,
			vialMg: v.vialMg,
			qty: 1,
			bacMl,
			mixedAt: now,
			createdAt: now
		});
		return;
	}
	await db().vials.update(v.id!, { bacMl, mixedAt: now });
}

/**
 * Send a mixed vial back to dry powder — for a mix logged by mistake.
 *
 * The BAC water it drew flows back to its bottle and the 28-day clock
 * disappears without touching anything else: both are derived from the two
 * fields being cleared. Written as an explicit dry row rather than an
 * update, so the mixed-only fields are gone rather than set to undefined.
 */
export async function unmixVial(id: number): Promise<void> {
	const v = await db().vials.get(id);
	if (!v) return;
	await db().vials.put({
		id: v.id,
		peptideId: v.peptideId,
		vialMg: v.vialMg,
		qty: v.qty ?? 1,
		createdAt: v.createdAt
	});
}

export async function deleteVial(id: number): Promise<void> {
	await db().vials.delete(id);
}

/**
 * Edit a vial in place. Only the user-entered fields are editable —
 * `usedMg` stays derived from dose logs, so correcting a typo in size or
 * water never desyncs the remaining figure.
 */
export async function updateVial(
	id: number,
	changes: Partial<Pick<Vial, 'peptideId' | 'vialMg' | 'qty' | 'bacMl' | 'mixedAt'>>
): Promise<void> {
	await db().vials.update(id, changes);
}

/* ============ Bacteriostatic water ============ */

export interface BacRow extends BacBottle {
	/** mL drawn from this bottle, summed from the vials mixed while it was current. */
	usedMl: number;
}

/**
 * Bottles newest first, each with the water already drawn from it.
 *
 * Usage is derived rather than stored: a mix records the mL it used, so a
 * bottle owns every mix from when it was added until the next bottle was.
 * That means deleting a vial correctly gives its water back, and it assumes
 * you open bottles one at a time — which is how they're actually used.
 */
export async function allBac(): Promise<BacRow[]> {
	const bottles = await db().bac.orderBy('createdAt').reverse().toArray();
	if (bottles.length === 0) return [];
	const vials = await db().vials.toArray();
	const oldestFirst = [...bottles].sort((a, b) => a.createdAt - b.createdAt);
	return bottles.map((b) => {
		const next = oldestFirst[oldestFirst.findIndex((x) => x.id === b.id) + 1];
		const until = next ? next.createdAt : Infinity;
		return {
			...b,
			usedMl: vials.reduce(
				(sum, v) =>
					v.bacMl && v.mixedAt && v.mixedAt >= b.createdAt && v.mixedAt < until
						? sum + v.bacMl
						: sum,
				0
			)
		};
	});
}

export async function addBac(volumeMl: number): Promise<void> {
	await db().bac.add({ volumeMl, createdAt: Date.now() });
}

export async function deleteBac(id: number): Promise<void> {
	await db().bac.delete(id);
}

/** Edit a bottle's size — usage stays derived from the mixes it covered. */
export async function updateBac(id: number, volumeMl: number): Promise<void> {
	await db().bac.update(id, { volumeMl });
}

/**
 * Vial inventory — what the user owns and how each vial is mixed.
 *
 * "Remaining" is derived, not stored: we sum the dose logs for that peptide
 * since the vial was mixed. That keeps the logging flow untouched (no vial
 * picker on every entry) at the cost of being approximate when two vials of
 * the same peptide are open at once.
 */
import { db, type BacBottle, type Vial } from './tracking-db';
import { parseDoseToMg } from './calculator';

/** Reconstituted peptide keeps roughly 28 days refrigerated. */
export const MIXED_SHELF_LIFE_DAYS = 28;
const DAY_MS = 86_400_000;

export interface VialRow extends Vial {
	/** mg drawn since the vial was mixed, summed from dose logs. */
	usedMg: number;
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
		// ponytail: `dose` is free text, so unparseable entries count as 0 and
		// the figure is a best effort. Store mg on DoseLog if it ever matters.
		usedMg: v.mixedAt
			? logs.reduce(
					(sum, l) =>
						l.peptideId === v.peptideId && l.takenAt >= v.mixedAt!
							? sum + (parseDoseToMg(l.dose) ?? 0)
							: sum,
					0
				)
			: 0
	}));
}

export async function addVial(
	peptideId: string,
	vialMg: number,
	bacMl?: number,
	qty = 1
): Promise<void> {
	const now = Date.now();
	await db().vials.add({
		peptideId,
		vialMg,
		qty: Math.max(1, Math.round(qty)),
		...(bacMl && bacMl > 0 ? { bacMl, mixedAt: now } : {}),
		createdAt: now
	});
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

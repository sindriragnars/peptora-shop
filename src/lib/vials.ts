/**
 * Vial inventory — what the user owns and how each vial is mixed.
 *
 * "Remaining" is derived, not stored: we sum the dose logs for that peptide
 * since the vial was mixed. That keeps the logging flow untouched (no vial
 * picker on every entry) at the cost of being approximate when two vials of
 * the same peptide are open at once.
 */
import { db, type Vial } from './tracking-db';
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

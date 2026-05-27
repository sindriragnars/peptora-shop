/**
 * Reconstitution math. Ported from the Android app's
 * `DoseCalculator.kt`. Pure functions — no UI, no state.
 *
 * The Peptora calculator answers one question: given a powder vial
 * mixed with N mL of bacteriostatic water, how many *insulin syringe
 * units* do you draw for your desired dose?
 *
 * Insulin syringes are marked in units (e.g. a U100 syringe has
 * 100 units per mL), which is what biohackers actually use to dose
 * peptides — not mL. Hence the conversion below.
 */

export type SyringeType = 'U100' | 'U50' | 'U40';

/**
 * Units per mL for each common insulin syringe type.
 * U100 is by far the most common (and what the Android app defaults to).
 */
const UNITS_PER_ML: Record<SyringeType, number> = {
	U100: 100,
	U50: 50,
	U40: 40
};

export interface CalcInputs {
	/** Total peptide content in the vial, in mg. */
	vialSizeMg: number;
	/** Bacteriostatic water added during reconstitution, in mL. */
	bacWaterMl: number;
	/** Desired dose. Always in mg internally — UI converts from mcg if needed. */
	desiredDoseMg: number;
	syringe: SyringeType;
}

export interface CalcResult {
	/** Units to draw on the selected syringe. */
	unitsToDraw: number;
	/** Volume of reconstituted solution containing the dose, in mL. */
	doseVolumeMl: number;
	/** Resulting concentration, in mg/mL. */
	concentrationMgPerMl: number;
	/** Number of full doses the vial can yield. */
	dosesPerVial: number;
	/** Calendar days the vial lasts at twice-weekly dosing. */
	daysAtTwicePerWeek: number;
}

/**
 * Run the full calculation. Returns NaN-filled result for any input
 * that doesn't make physical sense (zero or negative). UI should
 * guard against rendering NaN values.
 */
export function calculate(inputs: CalcInputs): CalcResult {
	const { vialSizeMg, bacWaterMl, desiredDoseMg, syringe } = inputs;
	if (vialSizeMg <= 0 || bacWaterMl <= 0 || desiredDoseMg <= 0) {
		return {
			unitsToDraw: NaN,
			doseVolumeMl: NaN,
			concentrationMgPerMl: NaN,
			dosesPerVial: NaN,
			daysAtTwicePerWeek: NaN
		};
	}

	const concentrationMgPerMl = vialSizeMg / bacWaterMl;
	const doseVolumeMl = desiredDoseMg / concentrationMgPerMl;
	const unitsToDraw = doseVolumeMl * UNITS_PER_ML[syringe];
	const dosesPerVial = vialSizeMg / desiredDoseMg;
	// Twice a week → every ~3.5 days.
	const daysAtTwicePerWeek = dosesPerVial * 3.5;

	return {
		unitsToDraw,
		doseVolumeMl,
		concentrationMgPerMl,
		dosesPerVial,
		daysAtTwicePerWeek
	};
}

/**
 * Best-effort parse of a peptide's `dosage.standard.amount` string
 * (e.g. "250 mcg", "0.25 mg", "5 mg twice weekly") into an mg number.
 * Returns null when no numeric+unit pair is found; the calculator
 * page falls back to its own default in that case.
 */
export function parseDoseToMg(amount: string): number | null {
	const match = amount.match(/(\d+(?:\.\d+)?)\s*(mcg|µg|mg)/i);
	if (!match) return null;
	const value = parseFloat(match[1]);
	const unit = match[2].toLowerCase();
	if (unit === 'mg') return value;
	return value / 1000; // mcg or µg → mg
}

/**
 * Extract the first plain number from a string. Used to pull vial
 * size in mg ("5 mg" → 5) and BAC water volume in mL ("2 mL" → 2)
 * from a peptide's `reconstitution` block when we need to compute
 * units for the dosage card.
 */
export function parseFirstNumber(s: string): number | null {
	const m = s.match(/(\d+(?:\.\d+)?)/);
	return m ? parseFloat(m[1]) : null;
}

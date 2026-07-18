/**
 * Reconstitution math. Pure functions — no UI, no state.
 *
 * The Peptora calculator answers one question: given a powder vial
 * mixed with N mL of bacteriostatic water, how many *insulin syringe
 * units* do you draw for your desired dose?
 *
 * Modelling note: peptide-community syringes are uniformly U100
 * concentration — 100 units == 1 mL — even when the barrel is smaller.
 * What varies is the barrel CAPACITY (0.3 / 0.5 / 1.0 / 2.0 / 3.0 mL,
 * i.e. 30 / 50 / 100 / 200 / 300 units). Capacity doesn't change the
 * units-to-draw math; it just bounds the visual scale on the UI's
 * syringe illustration. The 2.0/3.0 mL sizes are ordinary (non-insulin)
 * syringes marked in mL — we still report units for a consistent
 * read-out and surface the mL figure alongside for those barrels.
 * (Older U50/U40 insulin concentrations exist but are rare in peptide
 * use; we deliberately don't model them.)
 */

export type SyringeCapacity = 30 | 50 | 100 | 200 | 300;

/** Syringe options offered in the picker, smallest barrel first. `ml` is
 *  the physical barrel size; `capacity` is that at U100 (100 units = 1 mL).
 *  Single source of truth so webapp + shop pickers stay identical. */
export const SYRINGE_OPTIONS: { capacity: SyringeCapacity; ml: number }[] = [
	{ capacity: 30, ml: 0.3 },
	{ capacity: 50, ml: 0.5 },
	{ capacity: 100, ml: 1.0 },
	{ capacity: 200, ml: 2.0 },
	{ capacity: 300, ml: 3.0 }
];

/** U100 concentration is the only assumption baked in — 100 units = 1 mL. */
const UNITS_PER_ML = 100;

/** Volume drawn for a given unit count on a U100 syringe. Barrel size is
 *  irrelevant — 10 units is 0.1 mL on a 0.3, 0.5 or 1 mL syringe alike. */
export const unitsToMl = (units: number): number => units / UNITS_PER_ML;

/** mg of peptide in a unit draw, given the vial's concentration (mg/mL).
 *  This is what a logged dose actually removes from a mixed vial. */
export const unitsToMg = (units: number, concentrationMgMl: number): number =>
	unitsToMl(units) * concentrationMgMl;

export interface CalcInputs {
	/** Total peptide content in the vial, in mg. */
	vialSizeMg: number;
	/** Bacteriostatic water added during reconstitution, in mL. */
	bacWaterMl: number;
	/** Desired dose. Always in mg internally — UI converts from mcg if needed. */
	desiredDoseMg: number;
	/** Barrel capacity in units. Affects only the UI's visual scale —
	 *  the math below is identical for every capacity since they're all
	 *  U100. Included on the input so consumers carry it through. */
	syringeCapacity: SyringeCapacity;
}

/**
 * Per-peptide calculator preset. Optional block on a peptide's data that
 * lets the calculator auto-fill sensible starting values when the user
 * picks that peptide: the vial sizes it commonly ships in, a recommended
 * reconstitution volume, and the typical dose range. All amounts in mg.
 */
export interface CalcPreset {
	/** Common vial sizes the peptide ships in, mg. First is the default. */
	vialOptionsMg: number[];
	/** Recommended bacteriostatic water to add, mL. */
	recommendedBacMl: number;
	/** Typical dose range, mg. */
	doseLowMg: number;
	doseHighMg: number;
	/** Preferred unit for showing the dose box (mcg for sub-mg peptides). */
	doseUnit: 'mcg' | 'mg';
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
	const { vialSizeMg, bacWaterMl, desiredDoseMg } = inputs;
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
	const unitsToDraw = doseVolumeMl * UNITS_PER_ML;
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

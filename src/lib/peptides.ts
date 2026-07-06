/**
 * Peptide data access. Reads the same JSON files shipped in the
 * Android APK and on peptora.app — keeping all three Peptora
 * surfaces (Android, marketing site, this WebApp) reading from
 * one source of truth.
 *
 * The data is bundled at build time via Vite's JSON import, so the
 * whole library lives in the static bundle and the app works fully
 * offline once installed.
 */
import peptidesEn from './data/peptides_en.json';
import peptidesIs from './data/peptides_is.json';
import type { CalcPreset } from './calculator';

export type Locale = 'en' | 'is';

export interface DosageTier {
	amount: string;
	frequency: string;
	route: string;
	duration: string;
}

export interface Peptide {
	id: string;
	name: string;
	fullName: string;
	categories: string[];
	tagline: string;
	description: string;
	mechanism: string;
	halfLife: string;
	fdaApproved: boolean;
	researchStatus: string;
	dosage: {
		beginner: DosageTier;
		standard: DosageTier;
		advanced: DosageTier;
	};
	timing: string;
	cycleInfo: string;
	reconstitution: {
		vialSize: string;
		bacWater: string;
		concentration: string;
		note: string;
	};
	/** Optional calculator preset — present for injectable peptides we have
	 *  reconstitution data for. Drives the calculator's auto-fill. */
	calcPreset?: CalcPreset;
	storage: string;
	benefits: string[];
	sideEffects: string[];
	contraindications: string[];
	genderNotes: {
		men: string;
		women: string;
	};
	research: Array<{
		title: string;
		summary: string;
		year: number;
		journal: string;
		url: string;
	}>;
	stacksWellWith: string[];
	popularity: number;
}

export interface Category {
	id: string;
	name: string;
	icon: string;
	color: string;
	description: string;
}

export interface Stack {
	id: string;
	name: string;
	description: string;
	peptides: string[];
	protocol: string;
	goal: string;
	experienceLevel: string;
	duration: string;
}

export interface Interaction {
	peptides: string[];
	warning: string;
}

interface Database {
	version: string;
	lastUpdated: string;
	disclaimer: string;
	categories: Category[];
	peptides: Peptide[];
	stacks: Stack[];
	interactions: Interaction[];
}

const dataByLocale: Record<Locale, Database> = {
	en: peptidesEn as Database,
	is: peptidesIs as Database
};

export function getDatabase(locale: Locale = 'en'): Database {
	return dataByLocale[locale];
}

export function getAllPeptides(locale: Locale = 'en'): Peptide[] {
	// Sorted by popularity so any caller iterating the list shows
	// well-known compounds first. Used on Home (top 6 popular) and
	// search/category browsing.
	return [...dataByLocale[locale].peptides].sort((a, b) => b.popularity - a.popularity);
}

/**
 * Same data as {@link getAllPeptides} but sorted alphabetically by name with
 * digit-prefixed names (e.g. "5-Amino-1MQ") pushed to the end. Use this in
 * pickers where users scan for a specific name rather than browsing by
 * popularity (Stack Builder, Reminder/Dose Log peptide selectors).
 */
export function getAllPeptidesAlphabetical(locale: Locale = 'en'): Peptide[] {
	const startsWithDigit = (s: string) => /^\d/.test(s);
	return [...dataByLocale[locale].peptides].sort((a, b) => {
		const aDigit = startsWithDigit(a.name);
		const bDigit = startsWithDigit(b.name);
		if (aDigit !== bDigit) return aDigit ? 1 : -1;
		return a.name.localeCompare(b.name, locale, { sensitivity: 'base' });
	});
}

export function getPeptide(id: string, locale: Locale = 'en'): Peptide | undefined {
	return dataByLocale[locale].peptides.find((p) => p.id === id);
}

export function getCategories(locale: Locale = 'en'): Category[] {
	return dataByLocale[locale].categories;
}

export function getCategory(id: string, locale: Locale = 'en'): Category | undefined {
	return dataByLocale[locale].categories.find((c) => c.id === id);
}

export function getPeptidesByCategory(categoryId: string, locale: Locale = 'en'): Peptide[] {
	return getAllPeptides(locale).filter((p) => p.categories.includes(categoryId));
}

export function getStacks(locale: Locale = 'en'): Stack[] {
	return dataByLocale[locale].stacks;
}

export function getStack(id: string, locale: Locale = 'en'): Stack | undefined {
	return dataByLocale[locale].stacks.find((s) => s.id === id);
}

export function getInteractions(locale: Locale = 'en'): Interaction[] {
	return dataByLocale[locale].interactions;
}

/**
 * Lightweight search. Matches against id, name, fullName, and tagline.
 * Case-insensitive substring — good enough for a list of 31 items.
 */
export function searchPeptides(query: string, locale: Locale = 'en'): Peptide[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return getAllPeptides(locale).filter((p) => {
		const haystack = `${p.id} ${p.name} ${p.fullName} ${p.tagline}`.toLowerCase();
		return haystack.includes(q);
	});
}

/**
 * User preferences — theme + language. Svelte 5 runes module
 * (`.svelte.ts` so $state works at module scope).
 *
 * Pre-hydration: app.html runs a tiny inline script that sets the
 * `.dark` class on <html> before paint, reading the same
 * `peptora.theme` key — no flash of the wrong theme on first load.
 *
 * Language is persisted but does not yet drive content swap; all
 * pages still call get*(id, 'en'). Wiring the rest of the app to
 * read `prefs.lang` reactively lands in v0.4 polish.
 */

import type { Locale } from './peptides';

export type Theme = 'light' | 'dark' | 'system';
export type Experience = 'beginner' | 'standard' | 'advanced';
export type Gender = 'male' | 'female' | 'other';

const THEME_KEY = 'peptora.theme';
const LANG_KEY = 'peptora.lang';
const EXP_KEY = 'peptora.experience';
const GENDER_KEY = 'peptora.gender';
const SAFETY_KEY = 'peptora.safetyWarnings';
const ONBOARDED_KEY = 'peptora.onboarded';
const VISIT_COUNT_KEY = 'peptora.visitCount';
const NEWSLETTER_DISMISSED_KEY = 'peptora.newsletterDismissed';

function readTheme(): Theme {
	if (typeof window === 'undefined') return 'system';
	const v = window.localStorage.getItem(THEME_KEY);
	if (v === 'light' || v === 'dark' || v === 'system') return v;
	return 'system';
}

function readLang(): Locale {
	if (typeof window === 'undefined') return 'en';
	const v = window.localStorage.getItem(LANG_KEY);
	return v === 'is' ? 'is' : 'en';
}

function readExperience(): Experience {
	if (typeof window === 'undefined') return 'beginner';
	const v = window.localStorage.getItem(EXP_KEY);
	if (v === 'beginner' || v === 'standard' || v === 'advanced') return v;
	return 'beginner';
}

function readGender(): Gender {
	if (typeof window === 'undefined') return 'other';
	const v = window.localStorage.getItem(GENDER_KEY);
	if (v === 'male' || v === 'female' || v === 'other') return v;
	return 'other';
}

function readSafetyWarnings(): boolean {
	if (typeof window === 'undefined') return true;
	const v = window.localStorage.getItem(SAFETY_KEY);
	// Default ON — dose-related disclaimers should be opt-out, not opt-in.
	return v === null ? true : v === '1';
}

function readOnboarded(): boolean {
	if (typeof window === 'undefined') return true; // SSR: never redirect
	return window.localStorage.getItem(ONBOARDED_KEY) === '1';
}

function readVisitCount(): number {
	if (typeof window === 'undefined') return 0;
	const v = window.localStorage.getItem(VISIT_COUNT_KEY);
	return v ? parseInt(v, 10) || 0 : 0;
}

function readNewsletterDismissed(): boolean {
	if (typeof window === 'undefined') return true;
	return window.localStorage.getItem(NEWSLETTER_DISMISSED_KEY) === '1';
}

function applyTheme(t: Theme) {
	if (typeof document === 'undefined') return;
	const root = document.documentElement;
	const wantDark =
		t === 'dark' ||
		(t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	root.classList.toggle('dark', wantDark);
}

class Prefs {
	theme = $state<Theme>(readTheme());
	lang = $state<Locale>(readLang());
	experience = $state<Experience>(readExperience());
	gender = $state<Gender>(readGender());
	safetyWarnings = $state<boolean>(readSafetyWarnings());
	onboarded = $state<boolean>(readOnboarded());
	visitCount = $state<number>(readVisitCount());
	newsletterDismissed = $state<boolean>(readNewsletterDismissed());

	setTheme(t: Theme) {
		this.theme = t;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(THEME_KEY, t);
		}
		applyTheme(t);
	}

	setLang(l: Locale) {
		this.lang = l;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(LANG_KEY, l);
		}
	}

	setExperience(e: Experience) {
		this.experience = e;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(EXP_KEY, e);
		}
	}

	setGender(g: Gender) {
		this.gender = g;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(GENDER_KEY, g);
		}
	}

	setSafetyWarnings(b: boolean) {
		this.safetyWarnings = b;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(SAFETY_KEY, b ? '1' : '0');
		}
	}

	completeOnboarding() {
		this.onboarded = true;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(ONBOARDED_KEY, '1');
		}
	}

	/** Increment the visit counter — called once on mount per page-load. */
	bumpVisit() {
		this.visitCount = this.visitCount + 1;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(VISIT_COUNT_KEY, String(this.visitCount));
		}
	}

	dismissNewsletter() {
		this.newsletterDismissed = true;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(NEWSLETTER_DISMISSED_KEY, '1');
		}
	}

	/**
	 * Wipe every local Peptora artefact — localStorage keys + the
	 * IndexedDB database. Used by the "Clear all data" Settings
	 * button and during testing.
	 */
	async clearAllData() {
		if (typeof window === 'undefined') return;
		// Wipe namespaced localStorage keys.
		for (const k of [
			THEME_KEY,
			LANG_KEY,
			EXP_KEY,
			GENDER_KEY,
			SAFETY_KEY,
			ONBOARDED_KEY,
			VISIT_COUNT_KEY,
			NEWSLETTER_DISMISSED_KEY,
			'peptora.customStacks',
			'peptora.lastSync'
		]) {
			window.localStorage.removeItem(k);
		}
		// Drop the IndexedDB database. Use the raw API so we don't
		// have to dynamically import Dexie here.
		try {
			const req = indexedDB.deleteDatabase('peptora');
			await new Promise<void>((resolve, reject) => {
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
				req.onblocked = () => resolve(); // best effort
			});
		} catch (_) {
			/* ignore — already deleted or no IDB */
		}
	}
}

export const prefs = new Prefs();

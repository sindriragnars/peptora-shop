/**
 * Custom user-built stacks. v0.2 stores them in localStorage as a
 * single JSON array under `peptora.customStacks`. v0.3 will migrate
 * this to IndexedDB (via Dexie) alongside the reminders + dose log
 * — at that point this module's API stays the same, only the
 * persistence layer swaps out.
 *
 * All functions are SSR-safe (no-op on the server). Callers in
 * +page.svelte typically wrap reads in $effect so they run only
 * after hydration.
 */

import type { Interaction } from './peptides';

export interface CustomStackPeptide {
	id: string;
	dose: string;
}

export interface CustomStack {
	id: string;
	name: string;
	peptides: CustomStackPeptide[];
	createdAt: number;
}

const STORAGE_KEY = 'peptora.customStacks';

function isBrowser(): boolean {
	return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getCustomStacks(): CustomStack[] {
	if (!isBrowser()) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as CustomStack[]) : [];
	} catch {
		return [];
	}
}

export function getCustomStack(id: string): CustomStack | undefined {
	return getCustomStacks().find((s) => s.id === id);
}

export function saveCustomStack(stack: CustomStack): void {
	if (!isBrowser()) return;
	const stacks = getCustomStacks();
	const idx = stacks.findIndex((s) => s.id === stack.id);
	if (idx >= 0) stacks[idx] = stack;
	else stacks.unshift(stack); // newest first
	localStorage.setItem(STORAGE_KEY, JSON.stringify(stacks));
}

export function deleteCustomStack(id: string): void {
	if (!isBrowser()) return;
	const filtered = getCustomStacks().filter((s) => s.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function makeStackId(): string {
	// Random short id is fine — never need to be globally unique,
	// only unique within this user's localStorage.
	return Math.random().toString(36).slice(2, 10);
}

/**
 * Given a set of selected peptide ids and the global interactions
 * table, return only the warnings that involve at least 2 of the
 * selected peptides. Used by the Stack Builder to surface conflicts
 * live as the user adds peptides.
 */
export function relevantInteractions(
	selectedIds: string[],
	all: Interaction[]
): Interaction[] {
	const set = new Set(selectedIds);
	return all.filter((w) => w.peptides.filter((id) => set.has(id)).length >= 2);
}

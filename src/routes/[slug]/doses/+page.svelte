<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { getAllPeptidesAlphabetical, getPeptide, searchPeptides } from '$lib/peptides';
	import {
		dayStreak,
		deleteLog,
		dosesOnDay,
		dosesThisMonth,
		heatmap,
		logDose,
		mostTaken,
		recentDoses,
		type HeatmapCell
	} from '$lib/tracking';
	import {
		addReminder,
		allReminders,
		deleteReminder,
		describeDays,
		updateReminder
	} from '$lib/reminders';
	import {
		addBac,
		addVial,
		allBac,
		allVials,
		concentrationMgMl,
		deleteBac,
		deleteVial,
		expiresAt,
		mixOne,
		updateBac,
		updateVial,
		type BacRow,
		type VialRow
	} from '$lib/vials';
	import type { DoseLog, Reminder } from '$lib/tracking-db';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	const s = $derived(strings[prefs.lang]);
	const allPeptides = $derived(getAllPeptidesAlphabetical(prefs.lang));

	// My Vials is the default landing tab on /doses — the inventory is
	// what you check most; reminders + tracking are opt-in via ?tab=.
	// Old ?tab=vials links fall through to the default and keep working.
	// `browser` gate keeps the prerenderer happy.
	const tab = $derived<'reminders' | 'tracking' | 'vials'>(
		browser
			? ((['reminders', 'tracking'] as const).find((t) => t === page.url.searchParams.get('tab')) ??
					'vials')
			: 'vials'
	);

	function switchTab(t: 'reminders' | 'tracking' | 'vials') {
		const url = new URL(page.url);
		if (t === 'vials') url.searchParams.delete('tab');
		else url.searchParams.set('tab', t);
		goto(url, { replaceState: true, noScroll: true });
	}

	// ===== Vials — what the user owns and how each is mixed =====
	let vialRows = $state<VialRow[]>([]);
	let vialsLoaded = $state(false);
	let vialSheetOpen = $state(false);
	let vialPeptideId = $state('');
	let vialMg = $state(5);
	let vialQty = $state(1);
	let vialBac = $state<number | null>(null);
	/** Per-vial BAC input for the inline "mix" action on a dry vial. */
	let mixInputs = $state<Record<number, number>>({});

	// Load the inventory the first time the tab is opened.
	$effect(() => {
		if (tab === 'vials' && !vialsLoaded && browser) {
			vialsLoaded = true;
			refreshVials();
		}
	});

	// Split the list so mixed and unmixed never blur together — they need
	// different things from you (one is in use, the other is still stock).
	const mixedVials = $derived(vialRows.filter((v) => v.mixedAt));
	const dryVials = $derived(vialRows.filter((v) => !v.mixedAt));

	// Bacteriostatic water stock — depletes as vials are mixed.
	let bacRows = $state<BacRow[]>([]);
	let bacInput = $state(30);

	async function refreshVials() {
		vialRows = await allVials();
		bacRows = await allBac();
	}

	async function saveBac() {
		if (!(bacInput > 0)) return;
		await addBac(bacInput);
		await refreshVials();
	}

	async function removeBac(id: number) {
		await deleteBac(id);
		await refreshVials();
	}

	// Inline edit for a bottle's size — a mistyped 3 vs 30 mL matters.
	let bacEditId = $state<number | null>(null);
	let bacEditMl = $state(30);

	function startBacEdit(b: BacRow) {
		bacEditId = b.id!;
		bacEditMl = b.volumeMl;
	}

	async function saveBacEdit() {
		if (bacEditId === null || !(bacEditMl > 0)) return;
		await updateBac(bacEditId, bacEditMl);
		bacEditId = null;
		await refreshVials();
	}

	const presetBac = (peptideId: string) =>
		getPeptide(peptideId, prefs.lang)?.calcPreset?.recommendedBacMl ?? 2;

	// Picking a peptide prefills the vial size it usually ships in.
	function pickVialPeptide(id: string) {
		vialPeptideId = id;
		vialMg = getPeptide(id, prefs.lang)?.calcPreset?.vialOptionsMg[0] ?? 5;
	}

	function openVialSheet() {
		pickVialPeptide(allPeptides[0]?.id ?? '');
		vialQty = 1;
		vialBac = null;
		vialSheetOpen = true;
	}

	async function saveVial() {
		if (!vialPeptideId || vialMg <= 0) return;
		// Mixing at add-time only makes sense for a single vial; a stack of
		// several goes in dry and you mix one at a time from the list.
		await addVial(
			vialPeptideId,
			vialMg,
			vialQty === 1 ? (vialBac ?? undefined) : undefined,
			vialQty
		);
		vialSheetOpen = false;
		await refreshVials();
	}

	// Mixing pulls a single vial out of an unopened stack.
	async function doMix(v: VialRow, ml: number) {
		if (!(ml > 0)) return;
		await mixOne(v, ml);
		await refreshVials();
	}

	async function removeVial(id: number) {
		await deleteVial(id);
		await refreshVials();
	}

	// ===== Edit vial — fix a typo'd size, water volume or mix date =====
	let editVialId = $state<number | null>(null);
	let editVialMixed = $state(false);
	let editPeptideId = $state('');
	let editMg = $state(5);
	let editQty = $state(1);
	let editBacMl = $state(1);
	let editMixedDate = $state('');
	/** Snapshot of the date the sheet opened with — mixedAt is only
	 *  rewritten when the user actually changes the date. Writing it
	 *  unconditionally would snap the timestamp to midnight and could
	 *  land BEFORE the BAC bottle's createdAt, silently detaching the
	 *  mix from the bottle that paid for it. */
	let editMixedDateOriginal = '';

	function dateInputFromMs(ms: number): string {
		const d = new Date(ms);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function openEditVial(v: VialRow) {
		editVialId = v.id!;
		editVialMixed = !!v.mixedAt;
		editPeptideId = v.peptideId;
		editMg = v.vialMg;
		editQty = v.qty ?? 1;
		editBacMl = v.bacMl ?? presetBac(v.peptideId);
		editMixedDate = v.mixedAt ? dateInputFromMs(v.mixedAt) : '';
		editMixedDateOriginal = editMixedDate;
	}

	async function saveEditVial() {
		if (editVialId === null || !(editMg > 0)) return;
		if (editVialMixed && !(editBacMl > 0)) return;
		await updateVial(editVialId, {
			peptideId: editPeptideId,
			vialMg: editMg,
			...(editVialMixed
				? {
						bacMl: editBacMl,
						// Midnight local: "mixed on the 15th" counts that whole
						// day's logged doses against this vial.
						...(editMixedDate && editMixedDate !== editMixedDateOriginal
							? { mixedAt: new Date(editMixedDate + 'T00:00:00').getTime() }
							: {})
					}
				: { qty: Math.max(1, Math.round(editQty)) })
		});
		editVialId = null;
		await refreshVials();
	}

	const vialFmt = (n: number) => String(Math.round(n * 100) / 100);
	const vialDaysLeft = (until: number) => Math.ceil((until - Date.now()) / 86_400_000);
	const vialDate = (ms: number) =>
		new Date(ms).toLocaleDateString(prefs.lang === 'is' ? 'is-IS' : 'en-GB', {
			day: 'numeric',
			month: 'short'
		});

	// ===== Tracking =====
	let recent = $state<DoseLog[]>([]);
	let cells = $state<HeatmapCell[]>([]);
	let streak = $state(0);
	let monthCount = $state(0);
	let topPeptide = $state<string | null>(null);
	let loaded = $state(false);
	// Heatmap day-detail sheet: opens when the user taps a cell so they
	// can see what was actually logged that day (and delete individual
	// entries without leaving the heatmap context).
	let dayDetailOpen = $state(false);
	let dayDetailDate = $state(''); // YYYY-MM-DD
	let dayDetailLogs = $state<DoseLog[]>([]);

	async function openDayDetail(date: string) {
		dayDetailDate = date;
		dayDetailLogs = await dosesOnDay(date);
		dayDetailOpen = true;
	}

	async function refreshDayDetail() {
		if (!dayDetailDate) return;
		dayDetailLogs = await dosesOnDay(dayDetailDate);
	}

	async function refreshTracking() {
		const [r, h, s, m, t] = await Promise.all([
			recentDoses(5),
			heatmap(5),
			dayStreak(),
			dosesThisMonth(),
			mostTaken(30)
		]);
		recent = r;
		cells = h;
		streak = s;
		monthCount = m;
		topPeptide = t;
		loaded = true;
	}

	// ===== Reminders =====
	let reminders = $state<Reminder[]>([]);

	async function refreshReminders() {
		reminders = await allReminders();
	}

	$effect(() => {
		refreshTracking();
		refreshReminders();
	});

	// Toast banner shown after "Start this stack" creates a batch of
	// reminders. Source page passes ?created=<count>.
	let createdToast = $state(0);

	// Deep link: /doses?add=<peptide-id> from a peptide page's
	// "Add reminder" button. Opens the sheet with that peptide
	// pre-selected, then clears the query string so a refresh
	// doesn't re-open the sheet.
	//
	// onMount (not $effect) so we don't get caught in a loop —
	// $effect would re-run on the very goto() call below because
	// it tracks page.url as a reactive dependency.
	onMount(() => {
		if (!browser) return;
		const params = page.url.searchParams;
		const addId = params.get('add');
		const createdRaw = params.get('created');
		const created = createdRaw ? parseInt(createdRaw, 10) : 0;
		if (created > 0) createdToast = created;
		if (addId) openReminderSheet(addId);
		if (addId || created) {
			const url = new URL(page.url);
			url.searchParams.delete('add');
			url.searchParams.delete('created');
			// Both deep links are reminder flows — land on that tab, not
			// the My Vials default, so the user sees what they came for.
			url.searchParams.set('tab', 'reminders');
			goto(url, { replaceState: true, noScroll: true, keepFocus: true });
		}
	});

	// ===== Shared peptide picker state (used in both sheets) =====
	function freshPicker() {
		return { query: '', selectedId: null as string | null };
	}

	// ===== Log-dose sheet =====
	let logSheetOpen = $state(false);
	let logPicker = $state(freshPicker());
	let logDoseInput = $state('');
	// Backdating: lets the user catch up on missed doses. Defaults to
	// "now" each time the sheet opens; HTML date + time inputs are easy
	// for users to skim past if they don't need to change them.
	function todayTimeInput(): string {
		const d = new Date();
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}
	let logDateInput = $state(todayDateInput());
	let logTimeInput = $state(todayTimeInput());

	const logPickerResults = $derived(
		logPicker.query.trim()
			? searchPeptides(logPicker.query, prefs.lang)
			: allPeptides
	);
	const logSelected = $derived(
		logPicker.selectedId ? getPeptide(logPicker.selectedId, prefs.lang) : undefined
	);

	function openLogSheet() {
		logPicker = freshPicker();
		logDoseInput = '';
		logDateInput = todayDateInput();
		logTimeInput = todayTimeInput();
		logSheetOpen = true;
	}

	function pickForLog(id: string) {
		logPicker = { ...logPicker, selectedId: id };
		const p = getPeptide(id, prefs.lang);
		if (p) logDoseInput = p.dosage.standard.amount;
	}

	async function saveDoseLog() {
		if (!logPicker.selectedId || !logDoseInput.trim()) return;
		// Combine the date + time pickers into an epoch ms. logDose()
		// already accepts an explicit takenAt; if the user hasn't touched
		// the inputs we still build a fresh timestamp here, but it'll be
		// within ~1 minute of "now" which is good enough.
		const takenAt = new Date(`${logDateInput}T${logTimeInput}`).getTime();
		await logDose({
			peptideId: logPicker.selectedId,
			dose: logDoseInput.trim(),
			takenAt
		});
		logSheetOpen = false;
		await refreshTracking();
	}

	async function onDeleteLog(id?: number) {
		if (id === undefined) return;
		if (!confirm(s.reminders_delete)) return;
		await deleteLog(id);
		await refreshTracking();
	}

	// ===== Reminder sheet =====
	let reminderSheetOpen = $state(false);
	let reminderPicker = $state(freshPicker());
	let reminderDose = $state('');
	let reminderTime = $state('09:00');
	let reminderDays = $state<number[]>([1, 2, 3, 4, 5, 6, 0]); // default daily
	// Protocol window. Empty endDate = open-ended ("Forever" in the UI).
	// startDate defaults to today; the user can shift it forward if a
	// protocol is supposed to start later.
	function todayDateInput(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	let reminderStartDate = $state(todayDateInput());
	let reminderDuration = $state<'forever' | '4w' | '6w' | '8w' | '12w' | 'custom'>('forever');
	let reminderEndDate = $state('');

	const reminderPickerResults = $derived(
		reminderPicker.query.trim()
			? searchPeptides(reminderPicker.query, prefs.lang)
			: allPeptides
	);
	const reminderSelected = $derived(
		reminderPicker.selectedId ? getPeptide(reminderPicker.selectedId, prefs.lang) : undefined
	);

	function openReminderSheet(peptideId?: string) {
		reminderPicker = freshPicker();
		reminderDose = '';
		reminderTime = '09:00';
		reminderDays = [1, 2, 3, 4, 5, 6, 0];
		reminderStartDate = todayDateInput();
		reminderDuration = 'forever';
		reminderEndDate = '';
		reminderSheetOpen = true;
		// Deep-link from a peptide page: pre-select that peptide so the
		// user lands directly on the dose/time/days form.
		if (peptideId && getPeptide(peptideId, prefs.lang)) {
			pickForReminder(peptideId);
		}
	}

	/** Compute the protocol end-date from the selected duration preset.
	 *  Returns YYYY-MM-DD or '' for 'forever'. Custom keeps whatever the
	 *  user typed into the date field. */
	function endDateFromDuration(): string {
		if (reminderDuration === 'forever') return '';
		if (reminderDuration === 'custom') return reminderEndDate;
		const weeks = { '4w': 4, '6w': 6, '8w': 8, '12w': 12 }[reminderDuration];
		if (!weeks) return '';
		const start = new Date(reminderStartDate);
		start.setDate(start.getDate() + weeks * 7);
		return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
	}

	function pickForReminder(id: string) {
		reminderPicker = { ...reminderPicker, selectedId: id };
		const p = getPeptide(id, prefs.lang);
		if (p) reminderDose = p.dosage.standard.amount;
	}

	function toggleDay(d: number) {
		reminderDays = reminderDays.includes(d)
			? reminderDays.filter((x) => x !== d)
			: [...reminderDays, d];
	}

	async function saveReminder() {
		if (!reminderPicker.selectedId || !reminderDose.trim() || reminderDays.length === 0) return;
		// Resolve the protocol window into epoch ms. Parse as local time
		// (00:00) so a user setting endDate "2026-07-15" expects the
		// reminder to stop firing once that day starts in their TZ.
		const startsAt = new Date(reminderStartDate + 'T00:00:00').getTime();
		const endIso = endDateFromDuration();
		const endsAt = endIso ? new Date(endIso + 'T00:00:00').getTime() : undefined;

		// IndexedDB's structured clone chokes on Svelte 5 $state proxies.
		// Spread reminderDays into a plain array before persisting.
		await addReminder({
			peptideId: reminderPicker.selectedId,
			dose: reminderDose.trim(),
			time: reminderTime,
			days: [...reminderDays],
			enabled: true,
			startsAt,
			endsAt
		});
		reminderSheetOpen = false;
		await refreshReminders();
	}

	async function toggleReminderEnabled(r: Reminder) {
		if (r.id === undefined) return;
		await updateReminder(r.id, { enabled: !r.enabled });
		await refreshReminders();
	}

	async function onDeleteReminder(id?: number) {
		if (id === undefined) return;
		if (!confirm(s.reminders_delete)) return;
		await deleteReminder(id);
		await refreshReminders();
	}

	// ===== Helpers =====
	function shortDate(ts: number): string {
		const d = new Date(ts);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const logDay = new Date(d);
		logDay.setHours(0, 0, 0, 0);
		const days = Math.floor((today.getTime() - logDay.getTime()) / (24 * 60 * 60 * 1000));
		if (days === 0)
			return s.log_dose_today + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		if (days === 1)
			return s.log_dose_yesterday + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	// Sunday-first to match the existing UI order (S M T W T F S). Pulls
	// translated short labels from the i18n catalog so the picker grid
	// follows the user's chosen language.
	const dayLetters = $derived([
		s.day_short_sun,
		s.day_short_mon,
		s.day_short_tue,
		s.day_short_wed,
		s.day_short_thu,
		s.day_short_fri,
		s.day_short_sat
	] as const);
</script>

<svelte:head>
	<title>My Stuff · Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5">
	<h1 class="mt-2 mb-5 text-3xl font-bold tracking-tight">{s.doses_title}</h1>

	{#if createdToast > 0}
		<!-- Confirmation toast after a Start-this-stack flow lands here. -->
		<div
			class="bg-brand/10 text-brand mb-4 flex items-center justify-between gap-3 rounded-2xl border border-brand/30 p-3 text-sm"
		>
			<span>
				{s.doses_created_toast(createdToast)}
			</span>
			<button
				type="button"
				onclick={() => (createdToast = 0)}
				aria-label={s.doses_dismiss}
				class="-m-1 flex-shrink-0 p-1 opacity-70 hover:opacity-100"
			>
				<svg
					class="h-4 w-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
	{/if}

	<!-- Tab toggle -->
	<div
		class="border-outline dark:border-outline-dark mb-6 flex rounded-full border p-1 text-sm"
		role="tablist"
	>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'vials'}
			onclick={() => switchTab('vials')}
			class="flex-1 rounded-full py-2 font-medium transition-colors"
			class:bg-brand={tab === 'vials'}
			class:text-white={tab === 'vials'}
			class:text-muted={tab !== 'vials'}
		>
			{s.doses_tab_vials}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'reminders'}
			onclick={() => switchTab('reminders')}
			class="flex-1 rounded-full py-2 font-medium transition-colors"
			class:bg-brand={tab === 'reminders'}
			class:text-white={tab === 'reminders'}
			class:text-muted={tab !== 'reminders'}
		>
			{s.doses_tab_reminders}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'tracking'}
			onclick={() => switchTab('tracking')}
			class="flex-1 rounded-full py-2 font-medium transition-colors"
			class:bg-brand={tab === 'tracking'}
			class:text-white={tab === 'tracking'}
			class:text-muted={tab !== 'tracking'}
		>
			{s.doses_tab_tracking}
		</button>
	</div>

	{#if tab === 'tracking'}
		<!-- Stat cards -->
		<div class="mb-6 grid grid-cols-3 gap-2">
			<div class="border-outline dark:border-outline-dark rounded-2xl border p-3 text-center">
				<div class="text-brand text-2xl font-bold">{streak}</div>
				<div class="text-muted text-xs">{s.tracking_stat_streak}</div>
			</div>
			<div class="border-outline dark:border-outline-dark rounded-2xl border p-3 text-center">
				<div class="text-brand text-2xl font-bold">{monthCount}</div>
				<div class="text-muted text-xs">{s.tracking_stat_month}</div>
			</div>
			<div class="border-outline dark:border-outline-dark rounded-2xl border p-3 text-center">
				<div class="text-brand truncate text-sm font-semibold">
					{topPeptide ? (getPeptide(topPeptide, prefs.lang)?.name ?? topPeptide) : '—'}
				</div>
				<div class="text-muted text-xs">{s.tracking_stat_top}</div>
			</div>
		</div>

		<!-- Heatmap -->
		<section class="mb-6">
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.tracking_heatmap_title}</h2>
			<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
				<div class="grid grid-cols-7 gap-1.5">
					{#each cells as cell (cell.date)}
						{@const intensity = Math.min(cell.count, 3)}
						<button
							type="button"
							onclick={() => openDayDetail(cell.date)}
							class="hover:ring-brand/40 aspect-square rounded-md transition-shadow hover:ring-2"
							style={intensity === 0
								? 'background-color: rgb(14 124 102 / 0.08);'
								: `background-color: rgb(14 124 102 / ${0.25 + intensity * 0.2});`}
							title={`${cell.date}: ${cell.count} dose${cell.count === 1 ? '' : 's'}`}
							aria-label={`${cell.date}: ${cell.count} dose${cell.count === 1 ? '' : 's'}`}
						></button>
					{/each}
				</div>
				<div class="text-muted mt-3 flex items-center justify-end gap-1.5 text-xs">
					<span>{s.tracking_heatmap_less}</span>
					<div class="h-3 w-3 rounded" style="background-color: rgb(14 124 102 / 0.08);"></div>
					<div class="h-3 w-3 rounded" style="background-color: rgb(14 124 102 / 0.35);"></div>
					<div class="h-3 w-3 rounded" style="background-color: rgb(14 124 102 / 0.55);"></div>
					<div class="h-3 w-3 rounded" style="background-color: rgb(14 124 102 / 0.75);"></div>
					<span>{s.tracking_heatmap_more}</span>
				</div>
			</div>
		</section>

		<!-- Recent doses -->
		<section class="pb-24">
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.tracking_recent_title}</h2>
			{#if loaded && recent.length === 0}
				<div
					class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-6 text-center text-sm"
				>
					<p>{s.tracking_empty}</p>
				</div>
			{:else}
				<ul class="space-y-2">
					{#each recent as log (log.id)}
						{@const p = getPeptide(log.peptideId, prefs.lang)}
						<li
							class="border-outline dark:border-outline-dark flex items-center justify-between rounded-2xl border p-4"
						>
							<div class="min-w-0 flex-1">
								<div class="font-semibold">{p?.name ?? log.peptideId}</div>
								<div class="text-muted mt-0.5 text-xs">
									{log.dose} · {shortDate(log.takenAt)}
								</div>
							</div>
							<button
								type="button"
								onclick={() => onDeleteLog(log.id)}
								class="text-muted hover:text-red-600"
								aria-label={s.reminders_delete}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{:else if tab === 'vials'}
		<!-- Vials sub-tab — what you own and how each one is mixed -->
		<section class="pb-24">
			<!-- BAC water stock. Usage is derived from the vials you've mixed. -->
			<div class="border-outline dark:border-outline-dark mb-4 rounded-2xl border p-4">
				<div class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
					{s.bac_title}
				</div>
				{#if bacRows.length > 0}
					<ul class="mb-3 space-y-1.5">
						{#each bacRows as b (b.id)}
							{@const leftMl = b.volumeMl - b.usedMl}
							<li class="flex items-center justify-between gap-3 text-sm">
								{#if bacEditId === b.id}
									<input
										type="number"
										min="1"
										step="1"
										bind:value={bacEditMl}
										class="border-outline dark:border-outline-dark w-24 rounded-full border bg-transparent px-3 py-1.5 text-sm outline-none"
										aria-label={s.bac_size}
									/>
									<span class="text-muted text-xs">mL</span>
									<div class="ml-auto flex items-center gap-3">
										<button
											type="button"
											onclick={saveBacEdit}
											class="text-brand text-xs font-medium"
										>
											{s.bac_save}
										</button>
										<button
											type="button"
											onclick={() => (bacEditId = null)}
											class="text-muted text-xs"
										>
											{s.add_reminder_cancel}
										</button>
									</div>
								{:else}
									<span class="font-mono" class:text-red-600={leftMl <= 0}>
										{s.bac_left(vialFmt(Math.max(0, leftMl)), String(b.volumeMl))}
									</span>
									<div class="flex items-center gap-3">
										<button
											type="button"
											onclick={() => startBacEdit(b)}
											class="text-muted hover:text-brand text-xs"
										>
											{s.bac_edit}
										</button>
										<button
											type="button"
											onclick={() => removeBac(b.id!)}
											class="text-muted hover:text-red-600 text-xs"
										>
											{s.bac_delete}
										</button>
									</div>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				<div class="flex items-center gap-2">
					<input
						type="number"
						min="1"
						step="1"
						bind:value={bacInput}
						class="border-outline dark:border-outline-dark w-24 rounded-full border bg-transparent px-3 py-1.5 text-sm outline-none"
						aria-label={s.bac_add}
					/>
					<span class="text-muted text-xs">mL</span>
					<button
						type="button"
						onclick={saveBac}
						class="border-outline dark:border-outline-dark hover:border-brand ml-auto rounded-full border px-4 py-1.5 text-sm font-medium"
					>
						{s.bac_add}
					</button>
				</div>
			</div>

			{#if vialRows.length === 0}
				<div
					class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-8 text-center text-sm"
				>
					<p>{s.vials_empty}</p>
				</div>
			{:else}
				{#snippet vialCard(v: VialRow)}
					{@const p = getPeptide(v.peptideId, prefs.lang)}
					{@const conc = concentrationMgMl(v)}
					{@const until = expiresAt(v)}
					{@const left = Math.max(0, v.vialMg - v.usedMg)}
						<li class="border-outline dark:border-outline-dark rounded-2xl border p-4">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="font-medium">{p?.name ?? v.peptideId}</div>
									<div class="text-muted font-mono text-xs">
										{(v.qty ?? 1) > 1 ? `${v.qty} × ` : ''}{v.vialMg} mg
										{#if conc}
											· {v.bacMl} mL → {vialFmt(conc)} mg/mL
										{:else}
											· {s.vials_unmixed}
										{/if}
									</div>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => openEditVial(v)}
										class="text-muted hover:text-brand p-1"
										aria-label={s.vials_edit}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
										</svg>
									</button>
									<button
										type="button"
										onclick={() => removeVial(v.id!)}
										class="text-muted hover:text-red-600 p-1"
										aria-label={s.vials_delete}
									>
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="3 6 5 6 21 6" />
											<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
										</svg>
									</button>
								</div>
							</div>

							{#if conc && until}
								<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
									<span class="text-brand font-mono font-semibold">
										{s.vials_remaining(vialFmt(left), String(v.vialMg))}
									</span>
									{#if vialDaysLeft(until) > 0}
										<span class="text-muted">
											{s.vials_use_by(vialDate(until), String(vialDaysLeft(until)))}
										</span>
									{:else}
										<span class="text-red-600">{s.vials_expired}</span>
									{/if}
								</div>
							{:else}
								<!-- Dry powder: mix it here, prefilled with this peptide's usual water. -->
								<div class="mt-3 flex items-center gap-2">
									<input
										type="number"
										min="0.25"
										step="0.25"
										value={mixInputs[v.id!] ?? presetBac(v.peptideId)}
										oninput={(e) => (mixInputs[v.id!] = Number(e.currentTarget.value))}
										class="border-outline dark:border-outline-dark w-20 rounded-full border bg-transparent px-3 py-1.5 text-sm outline-none"
										aria-label={s.vials_bac}
									/>
									<span class="text-muted text-xs">mL</span>
									<button
										type="button"
										onclick={() => doMix(v, mixInputs[v.id!] ?? presetBac(v.peptideId))}
										class="bg-brand hover:bg-brand-dark ml-auto rounded-full px-4 py-1.5 text-sm font-medium text-white"
									>
										{s.vials_mix}
									</button>
								</div>
							{/if}
						</li>
				{/snippet}

				{#if mixedVials.length > 0}
					<h3 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
						{s.vials_group_mixed}
					</h3>
					<ul class="mb-6 space-y-2">
						{#each mixedVials as v (v.id)}{@render vialCard(v)}{/each}
					</ul>
				{/if}

				{#if dryVials.length > 0}
					<h3 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
						{s.vials_group_unmixed}
					</h3>
					<ul class="space-y-2">
						{#each dryVials as v (v.id)}{@render vialCard(v)}{/each}
					</ul>
				{/if}

				<p class="text-muted mt-3 text-xs">{s.vials_approx}</p>
			{/if}
		</section>
	{:else}
		<!-- Reminders sub-tab -->
		<aside
			class="text-muted mb-4 rounded-2xl bg-cream-dark/40 dark:bg-ink-soft/40 p-3 text-xs"
		>
			{s.reminders_pending_push}
		</aside>

		{#if reminders.length === 0}
			<div
				class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-8 pb-24 text-center"
			>
				<p>{s.reminders_empty}</p>
			</div>
		{:else}
			<ul class="space-y-2 pb-24">
				{#each reminders as r (r.id)}
					{@const p = getPeptide(r.peptideId, prefs.lang)}
					<li
						class="border-outline dark:border-outline-dark rounded-2xl border p-4"
						class:opacity-60={!r.enabled}
					>
						<div class="flex items-center justify-between gap-2">
							<div class="min-w-0 flex-1">
								<div class="font-semibold">{p?.name ?? r.peptideId}</div>
								<div class="text-muted mt-0.5 text-xs">
									{r.dose} · {r.time} · {describeDays(r.days)}
								</div>
								{#if r.endsAt}
									{@const daysLeft = Math.ceil((r.endsAt - Date.now()) / 86400000)}
									<div class="text-muted mt-1 text-xs">
										{#if daysLeft <= 0}
											<span class="text-red-600">{s.reminder_protocol_finished ?? 'Lokið'}</span>
										{:else if daysLeft === 1}
											{s.reminder_protocol_one_day_left ?? '1 dagur eftir'}
										{:else if daysLeft <= 14}
											{(s.reminder_protocol_days_left ?? '{n} dagar eftir').replace('{n}', String(daysLeft))}
										{:else}
											{@const weeksLeft = Math.round(daysLeft / 7)}
											{(s.reminder_protocol_weeks_left ?? '{n} vikur eftir').replace('{n}', String(weeksLeft))}
										{/if}
									</div>
								{/if}
							</div>
							<div class="flex items-center gap-1">
								<button
									type="button"
									onclick={() => toggleReminderEnabled(r)}
									class="rounded-full px-3 py-1 text-xs font-medium transition-colors"
									class:bg-brand={r.enabled}
									class:text-white={r.enabled}
									class:border={!r.enabled}
									class:border-cream-dark={!r.enabled}
									class:dark:border-ink-soft={!r.enabled}
									aria-label={r.enabled ? s.reminders_toggle_off : s.reminders_toggle_on}
								>
									{r.enabled ? s.reminders_toggle_on : s.reminders_toggle_off}
								</button>
								<button
									type="button"
									onclick={() => onDeleteReminder(r.id)}
									class="text-muted hover:text-red-600 p-1"
									aria-label={s.reminders_delete}
								>
									<svg
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="3 6 5 6 21 6" />
										<path
											d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
										/>
									</svg>
								</button>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

<!-- Floating + button — adapts to current sub-tab. -->
<button
	type="button"
	onclick={() => (tab === 'tracking' ? openLogSheet() : tab === 'vials' ? openVialSheet() : openReminderSheet())}
	class="bg-brand hover:bg-brand-dark fixed bottom-24 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg transition-colors"
	style="margin-bottom: env(safe-area-inset-bottom);"
	aria-label={tab === 'tracking'
		? s.tracking_log_dose
		: tab === 'vials'
			? s.vials_add_title
			: s.reminders_add}
>
	<svg
		width="24"
		height="24"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<line x1="12" y1="5" x2="12" y2="19" />
		<line x1="5" y1="12" x2="19" y2="12" />
	</svg>
</button>

<!-- Add-vial sheet -->
{#if vialSheetOpen}
	<div
		class="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={s.vials_add_title}
		onclick={(e) => {
			if (e.target === e.currentTarget) vialSheetOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') vialSheetOpen = false;
		}}
	>
		<div
			class="bg-cream dark:bg-ink w-full max-w-md rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
			style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom));"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight">{s.vials_add_title}</h2>
				<button
					type="button"
					onclick={() => (vialSheetOpen = false)}
					class="text-muted hover:text-ink dark:hover:text-cream"
					aria-label={s.add_reminder_cancel}
				>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="vial-peptide">
				{s.vials_peptide}
			</label>
			<select
				id="vial-peptide"
				value={vialPeptideId}
				onchange={(e) => pickVialPeptide(e.currentTarget.value)}
				class="border-outline dark:border-outline-dark mb-4 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
			>
				{#each allPeptides as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>

			<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="vial-mg">
				{s.vials_size}
			</label>
			{#if getPeptide(vialPeptideId, prefs.lang)?.calcPreset}
				{@const opts = getPeptide(vialPeptideId, prefs.lang)!.calcPreset!.vialOptionsMg}
				<div class="mb-2 flex flex-wrap gap-1.5">
					{#each opts as o (o)}
						<button
							type="button"
							onclick={() => (vialMg = o)}
							class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
							class:border-brand={vialMg === o}
							class:bg-brand={vialMg === o}
							class:text-white={vialMg === o}
							class:border-outline={vialMg !== o}
							class:text-muted={vialMg !== o}
						>
							{o} mg
						</button>
					{/each}
				</div>
			{/if}
			<input
				id="vial-mg"
				type="number"
				min="0.1"
				step="0.5"
				bind:value={vialMg}
				class="border-outline dark:border-outline-dark mb-4 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
			/>

			<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="vial-qty">
				{s.vials_qty}
			</label>
			<input
				id="vial-qty"
				type="number"
				min="1"
				step="1"
				bind:value={vialQty}
				class="border-outline dark:border-outline-dark mb-4 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
			/>

			{#if vialQty === 1}
				<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="vial-bac">
					{s.vials_mix_now}
				</label>
				<input
					id="vial-bac"
					type="number"
					min="0"
					step="0.25"
					placeholder={String(presetBac(vialPeptideId))}
					bind:value={vialBac}
					class="border-outline dark:border-outline-dark mb-5 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
				/>
			{:else}
				<p class="text-muted mb-5 text-xs">{s.vials_mix_later}</p>
			{/if}

			<button
				type="button"
				onclick={saveVial}
				class="bg-brand hover:bg-brand-dark w-full rounded-full py-3 text-sm font-medium text-white"
			>
				{s.vials_save}
			</button>
		</div>
	</div>
{/if}

<!-- Edit-vial sheet — same fields the add sheet collects, minus mix-now.
     Mixed vials edit water + mix date instead of quantity. -->
{#if editVialId !== null}
	<div
		class="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={s.vials_edit}
		onclick={(e) => {
			if (e.target === e.currentTarget) editVialId = null;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') editVialId = null;
		}}
	>
		<div
			class="bg-cream dark:bg-ink w-full max-w-md rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
			style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom));"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight">{s.vials_edit}</h2>
				<button
					type="button"
					onclick={() => (editVialId = null)}
					class="text-muted hover:text-ink dark:hover:text-cream"
					aria-label={s.add_reminder_cancel}
				>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="edit-vial-peptide">
				{s.vials_peptide}
			</label>
			<select
				id="edit-vial-peptide"
				bind:value={editPeptideId}
				class="border-outline dark:border-outline-dark mb-4 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
			>
				{#each allPeptides as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>

			<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="edit-vial-mg">
				{s.vials_size}
			</label>
			<input
				id="edit-vial-mg"
				type="number"
				min="0.1"
				step="0.5"
				bind:value={editMg}
				class="border-outline dark:border-outline-dark mb-4 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
			/>

			{#if editVialMixed}
				<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="edit-vial-bac">
					{s.vials_bac}
				</label>
				<input
					id="edit-vial-bac"
					type="number"
					min="0.25"
					step="0.25"
					bind:value={editBacMl}
					class="border-outline dark:border-outline-dark mb-4 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
				/>

				<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="edit-vial-mixed">
					{s.vials_mixed_date}
				</label>
				<input
					id="edit-vial-mixed"
					type="date"
					bind:value={editMixedDate}
					max={todayDateInput()}
					class="border-outline dark:border-outline-dark mb-5 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
				/>
			{:else}
				<label class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide" for="edit-vial-qty">
					{s.vials_qty}
				</label>
				<input
					id="edit-vial-qty"
					type="number"
					min="1"
					step="1"
					bind:value={editQty}
					class="border-outline dark:border-outline-dark mb-5 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
				/>
			{/if}

			<button
				type="button"
				onclick={saveEditVial}
				class="bg-brand hover:bg-brand-dark w-full rounded-full py-3 text-sm font-medium text-white"
			>
				{s.vials_save}
			</button>
		</div>
	</div>
{/if}

<!-- Log-dose sheet -->
{#if logSheetOpen}
	<div
		class="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={s.log_dose_title}
		onclick={(e) => {
			if (e.target === e.currentTarget) logSheetOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') logSheetOpen = false;
		}}
	>
		<div
			class="bg-cream dark:bg-ink w-full max-w-md rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
			style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom));"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight">{s.log_dose_title}</h2>
				<button
					type="button"
					onclick={() => (logSheetOpen = false)}
					class="text-muted hover:text-ink dark:hover:text-cream"
					aria-label={s.add_reminder_cancel}
				>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{#if !logSelected}
				<input
					type="search"
					bind:value={logPicker.query}
					placeholder={s.home_search_placeholder}
					class="border-outline dark:border-outline-dark focus:border-brand mb-3 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
				/>
				<ul class="max-h-72 space-y-1 overflow-y-auto">
					{#each logPickerResults as p (p.id)}
						<li>
							<button
								type="button"
								onclick={() => pickForLog(p.id)}
								class="hover:bg-cream-dark/60 dark:hover:bg-ink-soft/60 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors"
							>
								<span>
									<span class="font-medium">{p.name}</span>
									<span class="text-muted ml-2 text-xs">{p.tagline}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<button
					type="button"
					onclick={() => (logPicker = freshPicker())}
					class="text-muted mb-2 inline-flex items-center gap-1 text-xs hover:text-brand"
				>
					← {s.add_reminder_pick}
				</button>
				<div class="border-outline dark:border-outline-dark mb-3 rounded-2xl border p-3">
					<div class="font-semibold">{logSelected.name}</div>
					<div class="text-muted text-xs">{logSelected.tagline}</div>
				</div>
				<label class="mb-4 block">
					<span class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">{s.log_dose_amount}</span>
					<input
						type="text"
						bind:value={logDoseInput}
						placeholder={s.builder_dose_placeholder}
						class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-2xl border bg-transparent px-4 py-3 text-base outline-none"
					/>
				</label>
				<!-- Backdate option: defaults to now, but lets the user catch
				     up on missed doses without lying about when they took them.
				     Two-column grid so date + time stay scannable. -->
				<div class="mb-4 grid grid-cols-2 gap-3">
					<label class="block">
						<span class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">
							{s.log_dose_date ?? 'Dagsetning'}
						</span>
						<input
							type="date"
							bind:value={logDateInput}
							max={todayDateInput()}
							class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-2xl border bg-transparent px-3 py-2.5 text-sm outline-none"
						/>
					</label>
					<label class="block">
						<span class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">
							{s.log_dose_time ?? 'Tími'}
						</span>
						<input
							type="time"
							bind:value={logTimeInput}
							class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-2xl border bg-transparent px-3 py-2.5 text-sm outline-none"
						/>
					</label>
				</div>
				<button
					type="button"
					onclick={saveDoseLog}
					disabled={!logDoseInput.trim()}
					class="bg-brand hover:bg-brand-dark w-full rounded-full py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
				>
					{s.log_dose_save}
				</button>
			{/if}
		</div>
	</div>
{/if}

<!-- Heatmap day-detail sheet -->
{#if dayDetailOpen}
	<div
		class="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
		role="dialog"
		aria-modal="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) dayDetailOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') dayDetailOpen = false;
		}}
	>
		<div
			class="bg-cream dark:bg-ink w-full max-w-md rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
			style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); max-height: 90vh; overflow-y: auto;"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight">
					{new Date(dayDetailDate + 'T00:00:00').toLocaleDateString(prefs.lang === 'is' ? 'is-IS' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
				</h2>
				<button
					type="button"
					onclick={() => (dayDetailOpen = false)}
					class="text-muted hover:text-foreground -mr-1 p-1"
					aria-label={s.add_reminder_close ?? 'Loka'}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{#if dayDetailLogs.length === 0}
				<p class="text-muted py-8 text-center text-sm">
					{s.tracking_day_empty ?? 'Engar skammtar þennan dag.'}
				</p>
			{:else}
				<ul class="space-y-2">
					{#each dayDetailLogs as log (log.id)}
						{@const p = getPeptide(log.peptideId, prefs.lang)}
						<li class="border-outline dark:border-outline-dark flex items-start justify-between gap-3 rounded-2xl border p-3">
							<div class="min-w-0 flex-1">
								<div class="font-semibold">{p?.name ?? log.peptideId}</div>
								<div class="text-muted mt-0.5 text-xs">
									{log.dose} · {new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</div>
								{#if log.note}
									<div class="text-muted mt-1 text-xs italic">{log.note}</div>
								{/if}
							</div>
							<button
								type="button"
								onclick={async () => {
									if (log.id === undefined) return;
									if (!confirm(s.reminders_delete)) return;
									await deleteLog(log.id);
									await refreshDayDetail();
									await refreshTracking();
								}}
								class="text-muted hover:text-red-600 p-1"
								aria-label={s.reminders_delete}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<polyline points="3 6 5 6 21 6" />
									<path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
{/if}

<!-- Reminder sheet -->
{#if reminderSheetOpen}
	<div
		class="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm sm:items-center sm:justify-center"
		role="dialog"
		aria-modal="true"
		aria-label={s.add_reminder_title}
		onclick={(e) => {
			if (e.target === e.currentTarget) reminderSheetOpen = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') reminderSheetOpen = false;
		}}
	>
		<div
			class="bg-cream dark:bg-ink w-full max-w-md rounded-t-3xl p-5 shadow-2xl sm:rounded-3xl"
			style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom)); max-height: 90vh; overflow-y: auto;"
		>
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl font-bold tracking-tight">{s.add_reminder_title}</h2>
				<button
					type="button"
					onclick={() => (reminderSheetOpen = false)}
					class="text-muted hover:text-ink dark:hover:text-cream"
					aria-label={s.add_reminder_cancel}
				>
					<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>

			{#if !reminderSelected}
				<input
					type="search"
					bind:value={reminderPicker.query}
					placeholder={s.home_search_placeholder}
					class="border-outline dark:border-outline-dark focus:border-brand mb-3 w-full rounded-full border bg-transparent px-4 py-3 text-sm outline-none"
				/>
				<ul class="max-h-72 space-y-1 overflow-y-auto">
					{#each reminderPickerResults as p (p.id)}
						<li>
							<button
								type="button"
								onclick={() => pickForReminder(p.id)}
								class="hover:bg-cream-dark/60 dark:hover:bg-ink-soft/60 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors"
							>
								<span>
									<span class="font-medium">{p.name}</span>
									<span class="text-muted ml-2 text-xs">{p.tagline}</span>
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<button
					type="button"
					onclick={() => (reminderPicker = freshPicker())}
					class="text-muted mb-2 inline-flex items-center gap-1 text-xs hover:text-brand"
				>
					← {s.add_reminder_pick}
				</button>
				<div class="border-outline dark:border-outline-dark mb-3 rounded-2xl border p-3">
					<div class="font-semibold">{reminderSelected.name}</div>
					<div class="text-muted text-xs">{reminderSelected.tagline}</div>
				</div>

				<label class="mb-3 block">
					<span class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">{s.add_reminder_dose}</span>
					<input
						type="text"
						bind:value={reminderDose}
						placeholder={s.builder_dose_placeholder}
						class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-2xl border bg-transparent px-4 py-3 text-base outline-none"
					/>
				</label>

				<label class="mb-3 block">
					<span class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">{s.add_reminder_time}</span>
					<input
						type="time"
						bind:value={reminderTime}
						class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-2xl border bg-transparent px-4 py-3 text-base outline-none"
					/>
				</label>

				<div class="mb-4">
					<span class="text-muted mb-2 block text-xs font-medium uppercase tracking-wide">{s.add_reminder_days}</span>
					<div class="flex justify-between gap-1">
						{#each dayLetters as letter, i (i)}
							{@const active = reminderDays.includes(i)}
							<button
								type="button"
								onclick={() => toggleDay(i)}
								class="h-10 min-w-10 shrink-0 whitespace-nowrap rounded-full px-2 text-sm font-medium transition-colors"
								class:bg-brand={active}
								class:text-white={active}
								class:border={!active}
								class:border-cream-dark={!active}
								class:dark:border-ink-soft={!active}
								class:text-muted={!active}
								aria-pressed={active}
								aria-label={`Toggle ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]}`}
							>
								{letter}
							</button>
						{/each}
					</div>
				</div>

				<!-- Protocol window: start date + duration chooser. End date is
				     derived from duration unless the user explicitly picks
				     "Custom" and types one in. "Forever" is the default so a
				     plain daily reminder still works without filling anything. -->
				<div class="mb-4">
					<span class="text-muted mb-2 block text-xs font-medium uppercase tracking-wide">
						{s.add_reminder_protocol ?? 'Tímabil (valfrjálst)'}
					</span>
					<div class="grid grid-cols-2 gap-2">
						<label class="block">
							<span class="text-muted mb-1 block text-xs">{s.add_reminder_start_date ?? 'Hefst'}</span>
							<input
								type="date"
								bind:value={reminderStartDate}
								class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
							/>
						</label>
						<label class="block">
							<span class="text-muted mb-1 block text-xs">{s.add_reminder_duration ?? 'Lengd'}</span>
							<select
								bind:value={reminderDuration}
								class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
							>
								<option value="forever">{s.add_reminder_forever ?? 'Áframhaldandi'}</option>
								<option value="4w">4 {s.weeks_label ?? 'vikur'}</option>
								<option value="6w">6 {s.weeks_label ?? 'vikur'}</option>
								<option value="8w">8 {s.weeks_label ?? 'vikur'}</option>
								<option value="12w">12 {s.weeks_label ?? 'vikur'}</option>
								<option value="custom">{s.add_reminder_custom ?? 'Eigin dagsetning'}</option>
							</select>
						</label>
					</div>
					{#if reminderDuration === 'custom'}
						<label class="mt-2 block">
							<span class="text-muted mb-1 block text-xs">{s.add_reminder_end_date ?? 'Lýkur'}</span>
							<input
								type="date"
								bind:value={reminderEndDate}
								min={reminderStartDate}
								class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none"
							/>
						</label>
					{/if}
				</div>

				<button
					type="button"
					onclick={saveReminder}
					disabled={!reminderDose.trim() || reminderDays.length === 0}
					class="bg-brand hover:bg-brand-dark w-full rounded-full py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
				>
					{s.add_reminder_save}
				</button>
			{/if}
		</div>
	</div>
{/if}

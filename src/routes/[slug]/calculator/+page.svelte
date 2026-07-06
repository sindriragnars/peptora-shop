<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import {
		calculate,
		parseDoseToMg,
		SYRINGE_OPTIONS,
		type SyringeCapacity
	} from '$lib/calculator';
	import { getPeptide, getAllPeptidesAlphabetical } from '$lib/peptides';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	const s = $derived(strings[prefs.lang]);
	const allPeptides = $derived(getAllPeptidesAlphabetical(prefs.lang));

	// Selected peptide drives the auto-fill. Seed from ?peptide= (a deep link
	// from a peptide page) once, then it's user-driven via the picker.
	let selectedId = $state<string>('');
	let urlSeeded = $state(false);
	$effect(() => {
		if (!urlSeeded && browser) {
			const q = page.url.searchParams.get('peptide');
			if (q) selectedId = q;
			urlSeeded = true;
		}
	});
	const peptide = $derived(selectedId ? getPeptide(selectedId, prefs.lang) : undefined);
	const preset = $derived(peptide?.calcPreset);

	let vialSizeMg = $state(5);
	let bacWaterMl = $state(2);
	let doseValue = $state(250);
	let doseUnit = $state<'mcg' | 'mg'>('mcg');
	let syringeCapacity = $state<SyringeCapacity>(100);

	const round2 = (n: number) => Math.round(n * 100) / 100;

	// Auto-fill when the selected peptide changes. `appliedId` guards against
	// re-applying on every reactive tick — we fill once per selection, then
	// leave the user free to tweak. Peptides with a calcPreset get the full
	// treatment (vial + water + dose); the rest fall back to their standard
	// dose so the box isn't empty.
	let appliedId = $state<string | null>(null);
	$effect(() => {
		if (!peptide) {
			appliedId = null;
			return;
		}
		if (appliedId === peptide.id) return;
		if (preset) {
			vialSizeMg = preset.vialOptionsMg[0];
			bacWaterMl = preset.recommendedBacMl;
			doseUnit = preset.doseUnit;
			doseValue = round2(preset.doseUnit === 'mcg' ? preset.doseLowMg * 1000 : preset.doseLowMg);
		} else {
			const mg = parseDoseToMg(peptide.dosage.standard.amount);
			if (mg !== null) {
				if (mg < 1) {
					doseValue = Math.round(mg * 1000);
					doseUnit = 'mcg';
				} else {
					doseValue = mg;
					doseUnit = 'mg';
				}
			}
		}
		appliedId = peptide.id;
	});

	const desiredDoseMg = $derived(doseUnit === 'mg' ? doseValue : doseValue / 1000);
	const result = $derived(calculate({ vialSizeMg, bacWaterMl, desiredDoseMg, syringeCapacity }));

	const syringeMl = $derived((SYRINGE_OPTIONS.find((o) => o.capacity === syringeCapacity)?.ml ?? 1).toFixed(1));

	// Visual slider fill, 0–100% of the chosen barrel. Cap at 100% so an
	// over-draw doesn't overflow the bar — the number still shows the truth.
	const fillPercent = $derived(
		isFinite(result.unitsToDraw)
			? Math.min(100, Math.max(0, (result.unitsToDraw / syringeCapacity) * 100))
			: 0
	);
	const overdraw = $derived(isFinite(result.unitsToDraw) && result.unitsToDraw > syringeCapacity);

	// Typical-dose hint shown under the dose box, in the preset's own unit.
	const rangeText = $derived.by(() => {
		if (!preset) return null;
		const lo = preset.doseUnit === 'mcg' ? preset.doseLowMg * 1000 : preset.doseLowMg;
		const hi = preset.doseUnit === 'mcg' ? preset.doseHighMg * 1000 : preset.doseHighMg;
		const fmtNum = (n: number) => String(round2(n));
		return s.calc_dose_range(fmtNum(lo), fmtNum(hi), preset.doseUnit);
	});

	function fmt(n: number, digits = 2): string {
		if (!isFinite(n)) return '—';
		return n.toFixed(digits);
	}
</script>

<svelte:head>
	<title>Calculator · Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5">
	{#if peptide}
		<a
			href={`/peptides/${peptide.id}`}
			class="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand"
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
				aria-hidden="true"
			>
				<line x1="19" y1="12" x2="5" y2="12" />
				<polyline points="12 19 5 12 12 5" />
			</svg>
			{peptide.name}
		</a>
	{/if}

	<header class="mb-6">
		<h1 class="text-3xl font-bold tracking-tight">{s.calc_title}</h1>
		<p class="text-muted mt-1 text-sm">
			{peptide ? `${peptide.name} · ${s.calc_subtitle.toLowerCase()}` : s.calc_subtitle}
		</p>
	</header>

	<!-- Peptide picker: selecting one auto-fills the inputs below. -->
	<div class="border-outline dark:border-outline-dark mb-6 rounded-2xl border p-4">
		<label for="calc-peptide" class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">
			{s.calc_pick_peptide}
		</label>
		<select
			id="calc-peptide"
			bind:value={selectedId}
			class="w-full bg-transparent text-lg font-semibold outline-none"
		>
			<option value="">{s.calc_manual}</option>
			{#each allPeptides as p (p.id)}
				<option value={p.id}>{p.name}</option>
			{/each}
		</select>
	</div>

	<!-- Result card -->
	<div class="bg-brand/10 mb-6 rounded-2xl p-5 text-center">
		<p class="text-muted text-xs uppercase tracking-wide">{s.calc_units_label}</p>
		<p class="text-brand my-1 font-mono text-5xl font-bold tracking-tight">
			{fmt(result.unitsToDraw, 1)}
		</p>
		<p class="text-muted text-sm">
			<span class="font-mono font-semibold">= {fmt(result.doseVolumeMl, 2)} mL</span>
			· {s.calc_units_suffix(Number(syringeMl))}
		</p>

		<!-- Visual syringe: horizontal bar scaled to the chosen barrel, with a
		     brand fill up to the units-to-draw — a quick check the dose fits. -->
		<div class="mt-5">
			<div
				class="border-outline dark:border-outline-dark relative h-6 overflow-hidden rounded-full border bg-cream"
				role="img"
				aria-label={`Syringe fill: ${fmt(result.unitsToDraw, 1)} of ${syringeCapacity} units`}
			>
				<div
					class="h-full transition-all"
					class:bg-brand={!overdraw}
					class:bg-red-500={overdraw}
					style={`width: ${fillPercent}%`}
				></div>
			</div>
			<div class="text-muted mt-1 flex justify-between font-mono text-[10px]">
				<span>0</span>
				<span>{Math.round(syringeCapacity / 3)}</span>
				<span>{Math.round((syringeCapacity * 2) / 3)}</span>
				<span>{syringeCapacity}</span>
			</div>
			{#if overdraw}
				<p class="mt-1 text-center text-xs text-red-600">{s.calc_overdraw}</p>
			{/if}
		</div>
		<div class="text-muted mt-4 grid grid-cols-3 gap-2 text-xs">
			<div>
				<div class="font-mono text-sm font-semibold">{fmt(result.concentrationMgPerMl)}</div>
				<div>mg/mL</div>
			</div>
			<div>
				<div class="font-mono text-sm font-semibold">{Math.floor(result.dosesPerVial)}</div>
				<div>{s.calc_doses_per_vial}</div>
			</div>
			<div>
				<div class="font-mono text-sm font-semibold">{Math.floor(result.daysAtTwicePerWeek)}</div>
				<div>{s.calc_days}</div>
			</div>
		</div>
	</div>

	<!-- Inputs -->
	<div class="space-y-4">
		<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
			<div class="text-muted mb-1 text-xs font-medium uppercase tracking-wide">{s.calc_label_vial}</div>
			{#if preset && preset.vialOptionsMg.length > 1}
				<div class="mb-2 flex flex-wrap gap-1.5">
					{#each preset.vialOptionsMg as opt (opt)}
						<button
							type="button"
							class="rounded-full border px-3 py-1 text-xs font-medium transition-colors"
							class:border-brand={vialSizeMg === opt}
							class:bg-brand={vialSizeMg === opt}
							class:text-white={vialSizeMg === opt}
							class:border-outline={vialSizeMg !== opt}
							class:text-muted={vialSizeMg !== opt}
							onclick={() => (vialSizeMg = opt)}
						>
							{opt} mg
						</button>
					{/each}
				</div>
			{/if}
			<div class="flex items-baseline gap-2">
				<input
					type="number"
					min="0.1"
					step="0.5"
					bind:value={vialSizeMg}
					class="w-full bg-transparent text-2xl font-semibold outline-none"
					aria-label={s.calc_label_vial}
				/>
				<span class="text-muted text-sm">mg</span>
			</div>
		</div>

		<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
			<div class="mb-1 flex items-center justify-between">
				<span class="text-muted text-xs font-medium uppercase tracking-wide">{s.calc_label_water}</span>
				<span class="text-brand font-mono text-sm font-semibold">{fmt(bacWaterMl, 2)} mL</span>
			</div>
			<input
				type="range"
				min="0.5"
				max="5"
				step="0.25"
				bind:value={bacWaterMl}
				class="accent-brand mt-2 w-full"
				aria-label={s.calc_label_water}
			/>
			<div class="text-muted mt-1 flex justify-between text-xs">
				<span>0.5</span>
				<span>5 mL</span>
			</div>
		</div>

		<div class="border-outline dark:border-outline-dark block rounded-2xl border p-4">
			<div class="text-muted mb-1 text-xs font-medium uppercase tracking-wide">{s.calc_label_dose}</div>
			<div class="flex items-baseline gap-3">
				<input
					type="number"
					min="0.01"
					step={doseUnit === 'mcg' ? 25 : 0.1}
					bind:value={doseValue}
					class="w-full bg-transparent text-2xl font-semibold outline-none"
					aria-label={s.calc_label_dose}
				/>
				<div class="border-outline dark:border-outline-dark flex rounded-full border p-0.5 text-xs">
					{#each ['mcg', 'mg'] as const as u}
						<button
							type="button"
							class="rounded-full px-3 py-1 font-medium transition-colors"
							class:bg-brand={doseUnit === u}
							class:text-white={doseUnit === u}
							class:text-muted={doseUnit !== u}
							onclick={() => (doseUnit = u)}
						>
							{u}
						</button>
					{/each}
				</div>
			</div>
			{#if rangeText}
				<p class="text-muted mt-2 text-xs">{rangeText}</p>
			{/if}
		</div>

		<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
			<div class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.calc_label_syringe}</div>
			<div class="border-outline dark:border-outline-dark flex rounded-full border p-1 text-xs" role="radiogroup">
				{#each SYRINGE_OPTIONS as opt (opt.capacity)}
					<button
						type="button"
						role="radio"
						aria-checked={syringeCapacity === opt.capacity}
						class="flex-1 rounded-full py-1.5 text-center font-medium transition-colors"
						class:bg-brand={syringeCapacity === opt.capacity}
						class:text-white={syringeCapacity === opt.capacity}
						class:text-muted={syringeCapacity !== opt.capacity}
						onclick={() => (syringeCapacity = opt.capacity)}
					>
						<span class="block text-sm leading-none">{opt.ml.toFixed(1)}</span>
						<span class="block text-[10px] opacity-70">mL</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<aside
		class="mt-6 rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-4 text-xs leading-relaxed dark:bg-amber-950/30"
	>
		<p>{s.calc_disclaimer}</p>
	</aside>
</section>

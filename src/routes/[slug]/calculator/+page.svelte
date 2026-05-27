<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { calculate, parseDoseToMg, type SyringeType } from '$lib/calculator';
	import { getPeptide } from '$lib/peptides';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	const s = $derived(strings[prefs.lang]);

	// If we arrived via /calculator?peptide=foo, pre-fill the dose from
	// that peptide's standard tier — vial size + BAC water still need
	// the user's input because they vary by what they actually bought.
	// `browser` gate keeps the prerenderer happy (searchParams aren't
	// allowed at build-time on a prerendered route).
	const peptideId = $derived(browser ? page.url.searchParams.get('peptide') : null);
	const peptide = $derived(peptideId ? getPeptide(peptideId, prefs.lang) : undefined);

	let vialSizeMg = $state(5);
	let bacWaterMl = $state(2);
	let doseValue = $state(250);
	let doseUnit = $state<'mcg' | 'mg'>('mcg');
	let syringe = $state<SyringeType>('U100');

	// Pre-fill the dose box if the URL pointed us at a specific peptide,
	// but only on first render — don't fight the user once they edit.
	let dosePrefilled = $state(false);
	$effect(() => {
		if (peptide && !dosePrefilled) {
			const mg = parseDoseToMg(peptide.dosage.standard.amount);
			if (mg !== null) {
				if (mg < 1) {
					doseValue = Math.round(mg * 1000);
					doseUnit = 'mcg';
				} else {
					doseValue = mg;
					doseUnit = 'mg';
				}
				dosePrefilled = true;
			}
		}
	});

	const desiredDoseMg = $derived(doseUnit === 'mg' ? doseValue : doseValue / 1000);
	const result = $derived(calculate({ vialSizeMg, bacWaterMl, desiredDoseMg, syringe }));

	// Format helpers — clamp ridiculous decimals.
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

	<!-- Result card -->
	<div class="bg-brand/10 mb-6 rounded-2xl p-5 text-center">
		<p class="text-muted text-xs uppercase tracking-wide">{s.calc_units_label}</p>
		<p class="text-brand my-2 font-mono text-5xl font-bold tracking-tight">
			{fmt(result.unitsToDraw, 1)}
		</p>
		<p class="text-muted text-xs">{s.calc_units_suffix(syringe)}</p>
		<div class="text-muted mt-4 grid grid-cols-4 gap-2 text-xs">
			<div>
				<div class="font-mono text-sm font-semibold">{fmt(result.doseVolumeMl, 3)}</div>
				<div>mL</div>
			</div>
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
		<label class="border-outline dark:border-outline-dark block rounded-2xl border p-4">
			<div class="text-muted mb-1 text-xs font-medium uppercase tracking-wide">{s.calc_label_vial}</div>
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
		</label>

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

		<label class="border-outline dark:border-outline-dark block rounded-2xl border p-4">
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
				<div
					class="border-outline dark:border-outline-dark flex rounded-full border p-0.5 text-xs"
				>
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
		</label>

		<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
			<div class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.calc_label_syringe}</div>
			<div
				class="border-outline dark:border-outline-dark flex rounded-full border p-1 text-xs"
				role="radiogroup"
			>
				{#each ['U100', 'U50', 'U40'] as const as s}
					<button
						type="button"
						role="radio"
						aria-checked={syringe === s}
						class="flex-1 rounded-full py-1.5 font-medium transition-colors"
						class:bg-brand={syringe === s}
						class:text-white={syringe === s}
						class:text-muted={syringe !== s}
						onclick={() => (syringe = s)}
					>
						{s}
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

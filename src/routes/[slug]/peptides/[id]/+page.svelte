<script lang="ts">
	import type { PageProps } from './$types';
	import { calculate, parseDoseToMg, parseFirstNumber } from '$lib/calculator';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';
	import { getPeptide, getCategory } from '$lib/peptides';

	let { data }: PageProps = $props();

	const s = $derived(strings[prefs.lang]);

	// Re-derive from the locale data so flipping language swaps the
	// narrative content (description, mechanism, gender notes, …)
	// without a navigation. Fall back to the prerendered load() copy
	// if a record is missing in the active locale.
	const peptide = $derived(getPeptide(data.peptide.id, prefs.lang) ?? data.peptide);
	const categories = $derived(
		peptide.categories
			.map((id) => getCategory(id, prefs.lang))
			.filter((c): c is NonNullable<typeof c> => c !== undefined)
	);
	const stacksWith = $derived(
		peptide.stacksWellWith
			.map((id) => getPeptide(id, prefs.lang))
			.filter((p): p is NonNullable<typeof p> => p !== undefined)
	);

	type Tier = 'beginner' | 'standard' | 'advanced';
	let tier = $state<Tier>('beginner');
	const tierData = $derived(peptide.dosage[tier]);

	// Compact label for the dosage tab.
	const tierLabel = $derived<Record<Tier, string>>({
		beginner: s.peptide_dose_tab_beginner,
		standard: s.peptide_dose_tab_standard,
		advanced: s.peptide_dose_tab_advanced
	});

	// Gender notes default to whichever has content (men first).
	// Read from the prerendered load() data so we don't trip the
	// `state_referenced_locally` warning on the reactive `peptide`
	// derivation above; the initial pick only needs to happen once.
	type Gender = 'men' | 'women';
	const initialGender: Gender = data.peptide.genderNotes.men ? 'men' : 'women';
	let gender = $state<Gender>(initialGender);

	/* Inline reconstitution math for the dosage card. Pulls the
	   peptide's own vial/BAC defaults so the displayed "Draw N units"
	   matches what the calculator would compute if the user clicked
	   through. If any number fails to parse we just hide the slider
	   — the user can still tap the Calculator CTA at the bottom. */
	const vialMg = $derived(parseFirstNumber(peptide.reconstitution.vialSize));
	const bacMl = $derived(parseFirstNumber(peptide.reconstitution.bacWater));
	const doseMg = $derived(parseDoseToMg(tierData.amount));
	const calcResult = $derived(
		vialMg && bacMl && doseMg
			? calculate({
					vialSizeMg: vialMg,
					bacWaterMl: bacMl,
					desiredDoseMg: doseMg,
					syringe: 'U100'
				})
			: null
	);
	const sliderPercent = $derived(
		calcResult && isFinite(calcResult.unitsToDraw)
			? Math.min(100, Math.max(0, calcResult.unitsToDraw))
			: 0
	);
</script>

<svelte:head>
	<title>{peptide.name} · Peptora</title>
</svelte:head>

<article class="mx-auto max-w-md p-5 pb-32">
	<a
		href={`/categories/${peptide.categories[0]}`}
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

	<!-- ============= Header ============= -->
	<header class="mb-6">
		<h1 class="text-3xl font-bold tracking-tight">{peptide.name}</h1>
		<p class="text-muted mt-1 text-sm">{peptide.fullName}</p>
		<p class="text-brand mt-2 text-sm font-medium">{peptide.tagline}</p>
		<div class="mt-3 flex flex-wrap items-center gap-2">
			{#each categories as cat (cat.id)}
				<span
					class="rounded-full px-2.5 py-0.5 text-xs font-medium"
					style={`background-color: ${cat.color}25; color: ${cat.color};`}>{cat.name}</span
				>
			{/each}
			<span class="text-muted font-mono text-xs">★ {peptide.popularity}</span>
			{#if peptide.fdaApproved}
				<span
					class="bg-brand/10 text-brand inline-block rounded-full px-2 py-0.5 text-xs font-medium"
					>{s.category_filter_fda}</span
				>
			{/if}
		</div>
	</header>

	<!-- ============= Quick chips ============= -->
	<div
		class="border-outline dark:border-outline-dark mb-6 grid grid-cols-2 gap-4 rounded-2xl border p-4"
	>
		<div>
			<div class="text-muted text-xs uppercase tracking-wide">{s.peptide_quick_halflife}</div>
			<div class="mt-0.5 text-sm font-semibold">{peptide.halfLife}</div>
		</div>
		<div>
			<div class="text-muted text-xs uppercase tracking-wide">{s.peptide_timing_cycle}</div>
			<div class="mt-0.5 text-sm font-semibold">{peptide.cycleInfo}</div>
		</div>
		<div>
			<div class="text-muted text-xs uppercase tracking-wide">{s.peptide_quick_storage}</div>
			<div class="mt-0.5 text-sm font-semibold">{peptide.storage}</div>
		</div>
		<div>
			<div class="text-muted text-xs uppercase tracking-wide">{s.peptide_section_research}</div>
			<div class="mt-0.5 text-sm font-semibold">{peptide.researchStatus}</div>
		</div>
	</div>

	<!-- ============= About + Mechanism — single card ============= -->
	<section class="mb-6">
		<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.peptide_section_about}</h2>
		<div
			class="border-outline dark:border-outline-dark space-y-3 rounded-2xl border p-4 text-sm leading-relaxed"
		>
			<p>{peptide.description}</p>
			<div>
				<h3 class="text-brand mb-1 text-sm font-semibold">{s.peptide_mechanism_label}</h3>
				<p>{peptide.mechanism}</p>
			</div>
		</div>
	</section>

	<!-- ============= Dosage — tier toggle + big-amount card + slider ============= -->
	<section class="mb-6">
		<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.peptide_section_dosage}</h2>

		<!-- Tier toggle -->
		<div
			class="border-outline dark:border-outline-dark mb-3 flex rounded-full border p-1 text-xs"
			role="tablist"
		>
			{#each ['beginner', 'standard', 'advanced'] as const as t}
				<button
					type="button"
					role="tab"
					aria-selected={tier === t}
					class="flex-1 rounded-full py-1.5 font-medium transition-colors"
					class:bg-brand={tier === t}
					class:text-white={tier === t}
					class:text-muted={tier !== t}
					onclick={() => (tier = t)}
				>
					{tierLabel[t]}
				</button>
			{/each}
		</div>

		<!-- Main dosage card -->
		<div class="border-outline dark:border-outline-dark rounded-2xl border p-5">
			<div class="text-brand text-5xl font-bold tracking-tight">{tierData.amount}</div>
			<div class="text-muted mt-1 text-sm">{tierData.frequency}</div>

			{#if calcResult && isFinite(calcResult.unitsToDraw)}
				<!-- Syringe slider visualization -->
				<div class="mt-5">
					<div
						class="bg-cream-dark/60 dark:bg-ink-soft/60 relative h-2 rounded-full overflow-hidden"
					>
						<div
							class="bg-brand h-full rounded-full transition-all"
							style={`width: ${sliderPercent}%`}
						></div>
					</div>
					<div class="text-muted mt-1 flex justify-between text-[10px] font-mono">
						<span>0</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>60</span><span>70</span><span>80</span><span>90</span><span>100</span>
					</div>
					<p class="mt-3 text-sm">
						{s.peptide_dose_syringe_units(Number(calcResult.unitsToDraw.toFixed(1)))}
					</p>
					<p class="text-muted mt-1 text-xs">
						{peptide.reconstitution.vialSize} · {peptide.reconstitution.bacWater} BAC
					</p>
				</div>
			{/if}

			<div
				class="border-outline dark:border-outline-dark mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm"
			>
				<div>
					<div class="text-muted text-xs uppercase tracking-wide">{s.peptide_dose_route}</div>
					<div class="mt-0.5 font-semibold">{tierData.route}</div>
				</div>
				<div>
					<div class="text-muted text-xs uppercase tracking-wide">{s.peptide_dose_duration}</div>
					<div class="mt-0.5 font-semibold">{tierData.duration}</div>
				</div>
			</div>

			{#if peptide.timing}
				<p class="text-muted mt-3 text-xs"><strong>{s.peptide_timing_when}:</strong> {peptide.timing}</p>
			{/if}
		</div>
	</section>

	<!-- ============= Reconstitution ============= -->
	<section class="mb-6">
		<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
			{s.peptide_section_reconstitution}
		</h2>
		<div
			class="border-outline dark:border-outline-dark rounded-2xl border p-4 text-sm leading-relaxed"
		>
			<p>
				<strong>{s.calc_label_vial}:</strong> {peptide.reconstitution.vialSize} ·
				<strong>{s.calc_label_water}:</strong> {peptide.reconstitution.bacWater} ·
				<strong>{s.calc_concentration}:</strong> {peptide.reconstitution.concentration}
			</p>
			{#if peptide.reconstitution.note}
				<p class="text-muted mt-2 text-xs">{peptide.reconstitution.note}</p>
			{/if}
		</div>
	</section>

	<!-- ============= Benefits — green tinted card with checks ============= -->
	{#if peptide.benefits.length > 0}
		<section
			class="mb-6 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30"
		>
			<h2
				class="mb-3 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
			>
				{s.peptide_section_benefits}
			</h2>
			<ul class="space-y-2 text-sm">
				{#each peptide.benefits as b}
					<li class="flex items-start gap-2">
						<svg
							class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<polyline points="20 6 9 17 4 12" />
						</svg>
						<span>{b}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ============= Side effects — amber tinted card with warnings ============= -->
	{#if peptide.sideEffects.length > 0}
		<section
			class="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
		>
			<h2
				class="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
			>
				{s.peptide_section_side_effects}
			</h2>
			<ul class="space-y-2 text-sm">
				{#each peptide.sideEffects as s}
					<li class="flex items-start gap-2">
						<svg
							class="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
							<line x1="12" y1="9" x2="12" y2="13" />
							<line x1="12" y1="17" x2="12.01" y2="17" />
						</svg>
						<span>{s}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ============= Gender notes — Men/Women tab toggle ============= -->
	{#if peptide.genderNotes.men || peptide.genderNotes.women}
		<section class="mb-6">
			<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.peptide_section_gender}</h2>
			<div
				class="border-outline dark:border-outline-dark mb-3 flex rounded-full border p-1 text-xs"
				role="tablist"
			>
				{#each ['men', 'women'] as const as g}
					{@const has = !!peptide.genderNotes[g]}
					<button
						type="button"
						role="tab"
						aria-selected={gender === g}
						disabled={!has}
						onclick={() => (gender = g)}
						class="flex-1 rounded-full py-1.5 text-sm font-medium transition-colors disabled:opacity-40"
						class:bg-brand={gender === g && has}
						class:text-white={gender === g && has}
						class:text-muted={gender !== g}
					>
						{g === 'men' ? `♂ ${s.peptide_gender_men}` : `♀ ${s.peptide_gender_women}`}
					</button>
				{/each}
			</div>
			<div
				class="border-outline dark:border-outline-dark rounded-2xl border p-4 text-sm leading-relaxed"
			>
				{peptide.genderNotes[gender] || ''}
			</div>
		</section>
	{/if}

	<!-- ============= Contraindications / Cautions — red card ============= -->
	{#if peptide.contraindications.length > 0}
		<section
			class="mb-6 rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30"
		>
			<h2
				class="mb-3 text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300"
			>
				{s.peptide_section_cautions}
			</h2>
			<ul class="space-y-2 text-sm">
				{#each peptide.contraindications as c}
					<li class="flex items-start gap-2">
						<svg
							class="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
							<line x1="12" y1="9" x2="12" y2="13" />
							<line x1="12" y1="17" x2="12.01" y2="17" />
						</svg>
						<span>{c}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ============= Research / citations ============= -->
	{#if peptide.research.length > 0}
		<section class="mb-6">
			<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.peptide_section_research}</h2>
			<ul class="space-y-3">
				{#each peptide.research as r}
					<li
						class="border-outline dark:border-outline-dark rounded-xl border p-3 text-sm"
					>
						<a
							href={r.url}
							target="_blank"
							rel="noopener noreferrer"
							class="hover:text-brand font-medium"
						>
							{r.title}
						</a>
						<p class="text-muted mt-1 text-xs">
							{r.journal} · {r.year}
						</p>
						{#if r.summary}
							<p class="mt-1 text-xs">{r.summary}</p>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- ============= Stacks well with ============= -->
	{#if stacksWith.length > 0}
		<section class="mb-6">
			<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.peptide_section_stacks_well_with}</h2>
			<div class="flex flex-wrap gap-2">
				{#each stacksWith as p (p.id)}
					<a
						href={`/peptides/${p.id}`}
						class="bg-brand/10 text-brand hover:bg-brand/20 rounded-full px-3 py-1 text-xs font-medium"
					>
						{p.name}
					</a>
				{/each}
			</div>
		</section>
	{/if}

	<!-- ============= Disclaimer ============= -->
	<aside
		class="mt-8 rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-4 text-xs leading-relaxed dark:bg-amber-950/30"
	>
		<p class="mb-1 font-semibold">{s.stack_disclaimer_title}</p>
		<p>{s.peptide_disclaimer}</p>
	</aside>
</article>

<!-- Sticky CTAs above the bottom nav. Placeholder hrefs — calculator + reminders land in v0.3. -->
<div
	class="border-outline dark:border-outline-dark bg-cream/95 dark:bg-ink/95 fixed inset-x-0 bottom-[68px] z-30 border-t backdrop-blur"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	<div class="mx-auto flex max-w-md gap-2 p-3">
		<a
			href={`/doses?add=${peptide.id}`}
			class="border-outline dark:border-outline-dark hover:border-brand flex-1 rounded-full border py-2.5 text-center text-sm font-medium"
		>
			{s.peptide_action_add_reminder}
		</a>
		<a
			href={`/calculator?peptide=${peptide.id}`}
			class="bg-brand hover:bg-brand-dark flex-1 rounded-full py-2.5 text-center text-sm font-medium text-white"
		>
			{s.peptide_action_open_calculator}
		</a>
	</div>
</div>

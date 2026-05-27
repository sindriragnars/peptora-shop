<script lang="ts">
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { getStacks, getCategory, getPeptide } from '$lib/peptides';
	import { getCustomStacks, deleteCustomStack, type CustomStack } from '$lib/customStacks';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	const s = $derived(strings[prefs.lang]);
	const suggested = $derived(getStacks(prefs.lang));

	// Active tab comes from ?tab=custom — defaulting to suggested so a
	// clean /stacks URL still lands on the curated list, which is what
	// most users want.
	// `browser` gate avoids reading searchParams during prerender (build).
	const tab = $derived<'suggested' | 'custom'>(
		browser && page.url.searchParams.get('tab') === 'custom' ? 'custom' : 'suggested'
	);

	// Custom stacks live in localStorage; load after hydration so SSR
	// doesn't try to read window.
	let custom = $state<CustomStack[]>([]);
	$effect(() => {
		custom = getCustomStacks();
	});

	function switchTab(t: 'suggested' | 'custom') {
		const url = new URL(page.url);
		if (t === 'suggested') url.searchParams.delete('tab');
		else url.searchParams.set('tab', 'custom');
		goto(url, { replaceState: true, noScroll: true });
	}

	function removeStack(id: string) {
		if (!confirm(s.stack_delete_confirm)) return;
		deleteCustomStack(id);
		custom = getCustomStacks();
	}

	// Goal + level labels: both reactive on prefs.lang so the suggested-
	// stack badge row swaps language live. Fallback to raw id if a stack
	// references a goal we haven't translated yet.
	const goalLabel = $derived<Record<string, string>>({
		muscle: s.stack_goal_muscle,
		healing: s.stack_goal_healing,
		fat_loss: s.stack_goal_fat_loss,
		anti_aging: s.stack_goal_anti_aging,
		cognitive: s.stack_goal_cognitive,
		longevity: s.stack_goal_longevity
	});
	const levelLabel = $derived<Record<string, string>>({
		beginner: s.peptide_dose_tab_beginner,
		standard: s.peptide_dose_tab_standard,
		advanced: s.peptide_dose_tab_advanced
	});
</script>

<svelte:head>
	<title>Stacks · Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5">
	<h1 class="mt-2 mb-5 text-3xl font-bold tracking-tight">{s.stacks_title}</h1>

	<!-- Tab toggle: Suggested | Custom -->
	<div
		class="border-outline dark:border-outline-dark mb-6 flex rounded-full border p-1 text-sm"
		role="tablist"
	>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'suggested'}
			onclick={() => switchTab('suggested')}
			class="flex-1 rounded-full py-2 font-medium transition-colors"
			class:bg-brand={tab === 'suggested'}
			class:text-white={tab === 'suggested'}
			class:text-muted={tab !== 'suggested'}
		>
			{s.stacks_tab_suggested}
		</button>
		<button
			type="button"
			role="tab"
			aria-selected={tab === 'custom'}
			onclick={() => switchTab('custom')}
			class="flex-1 rounded-full py-2 font-medium transition-colors"
			class:bg-brand={tab === 'custom'}
			class:text-white={tab === 'custom'}
			class:text-muted={tab !== 'custom'}
		>
			{s.stacks_tab_custom}
		</button>
	</div>

	{#if tab === 'suggested'}
		<ul class="space-y-3">
			{#each suggested as stack (stack.id)}
				{@const cat = getCategory(stack.goal, prefs.lang)}
				{@const tint = cat?.color ?? '#94A3B8'}
				<li>
					<a
						href={`/stacks/${stack.id}`}
						class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-5 transition-colors"
						style={`background-color: ${tint}20`}
					>
						<h2 class="mb-1 text-lg font-semibold">{stack.name}</h2>
						<p class="text-muted line-clamp-2 text-xs">{stack.description}</p>
						<div class="mt-3 flex flex-wrap gap-1.5">
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								style={`background-color: ${tint}25; color: ${tint};`}
							>
								{goalLabel[stack.goal] ?? stack.goal}
							</span>
							<span
								class="border-outline dark:border-outline-dark rounded-full border px-2 py-0.5 text-xs font-medium"
							>
								{levelLabel[stack.experienceLevel] ?? stack.experienceLevel}
							</span>
							<span
								class="border-outline dark:border-outline-dark rounded-full border px-2 py-0.5 text-xs font-medium"
							>
								{stack.duration}
							</span>
						</div>
						<div class="text-muted mt-2 flex flex-wrap gap-1 font-mono text-xs">
							{#each stack.peptides as id (id)}
								{@const p = getPeptide(id, prefs.lang)}
								<span>{p?.name ?? id}</span>
							{/each}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{:else}
		<a
			href="/stacks/new"
			class="bg-brand hover:bg-brand-dark mb-5 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium text-white transition-colors"
		>
			<svg
				width="18"
				height="18"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			{s.stacks_build_new}
		</a>

		{#if custom.length === 0}
			<div
				class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-8 text-center"
			>
				<p class="text-sm">{s.stacks_custom_empty_title}</p>
				<p class="mt-1 text-xs">{s.stacks_custom_empty_hint}</p>
			</div>
		{:else}
			<!-- Custom cards mirror the suggested layout: tinted background,
			     "Custom" badge, full card is the navigation target. Delete
			     button sits absolutely positioned outside the link so the
			     tap targets don't collide. -->
			<ul class="space-y-3">
				{#each custom as stack (stack.id)}
					<li class="relative">
						<a
							href={`/stacks/custom/${stack.id}`}
							class="border-outline dark:border-outline-dark hover:border-brand bg-brand/10 block rounded-2xl border p-5 transition-colors"
						>
							<h2 class="mb-1 pr-8 text-lg font-semibold">{stack.name}</h2>
							<div class="mt-3 flex flex-wrap gap-1.5">
								<span
									class="bg-brand/15 text-brand rounded-full px-2 py-0.5 text-xs font-medium"
								>
									{s.stacks_custom_badge}
								</span>
							</div>
							<ul class="mt-3 space-y-1.5 text-sm">
								{#each stack.peptides as item (item.id)}
									{@const p = getPeptide(item.id, prefs.lang)}
									<li class="flex items-center justify-between gap-2">
										<span class="font-medium">{p?.name ?? item.id}</span>
										<span class="text-muted font-mono text-xs">{item.dose}</span>
									</li>
								{/each}
							</ul>
						</a>
						<button
							type="button"
							onclick={() => removeStack(stack.id)}
							aria-label={s.stack_delete_label}
							class="text-muted hover:text-red-600 absolute top-4 right-4 -m-1 p-1"
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
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

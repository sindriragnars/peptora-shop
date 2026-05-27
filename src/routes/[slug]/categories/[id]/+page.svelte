<script lang="ts">
	import type { PageProps } from './$types';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';
	import { getCategory, getPeptidesByCategory } from '$lib/peptides';

	let { data }: PageProps = $props();

	const s = $derived(strings[prefs.lang]);
	// Re-derive from peptides.ts in the current locale so flipping
	// language on the fly swaps the category description + peptide
	// taglines without a navigation. Falls back to the prerendered
	// load() data if the id somehow misses in the active locale.
	const category = $derived(getCategory(data.category.id, prefs.lang) ?? data.category);
	const peptides = $derived(getPeptidesByCategory(data.category.id, prefs.lang));
</script>

<svelte:head>
	<title>{category.name} · Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5">
	<a href="/" class="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand">
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
		{s.nav_home}
	</a>

	<header class="mb-6">
		<div class="mb-2 flex items-center gap-3">
			<span
				class="inline-block h-3 w-3 flex-shrink-0 rounded-full"
				style={`background-color: ${category.color}`}
				aria-hidden="true"
			></span>
			<h1 class="text-3xl font-bold tracking-tight">{category.name}</h1>
		</div>
		<p class="text-muted text-sm">{category.description}</p>
		<p class="text-muted mt-1 text-xs">{s.category_count(peptides.length)}</p>
	</header>

	<ul class="space-y-2">
		{#each peptides as p (p.id)}
			<li>
				<a
					href={`/peptides/${p.id}`}
					class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-4 transition-colors"
				>
					<div class="mb-0.5 flex items-center justify-between">
						<span class="font-semibold">{p.name}</span>
						<span class="text-brand font-mono text-xs">★ {p.popularity}</span>
					</div>
					<div class="text-muted line-clamp-2 text-xs">{p.tagline}</div>
					{#if p.fdaApproved}
						<span
							class="bg-brand/10 text-brand mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium"
						>
							{s.category_filter_fda}
						</span>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
</section>

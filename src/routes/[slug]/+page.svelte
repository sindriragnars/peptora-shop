<script lang="ts">
	import { page } from '$app/state';
	import { getCategories, getAllPeptides, searchPeptides } from '$lib/peptides';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';
	import { subscribe } from '$lib/newsletter';

	const s = $derived(strings[prefs.lang]);
	const pathPrefix = $derived<string>(page.data.pathPrefix ?? '');
	const categories = $derived(getCategories(prefs.lang));
	const allPeptides = $derived(getAllPeptides(prefs.lang));
	const popular = $derived(allPeptides.slice(0, 6));

	let query = $state('');
	const results = $derived(query.trim() ? searchPeptides(query, prefs.lang) : []);

	// Newsletter banner — surfaces after the user has been around long
	// enough to know if the app is for them (3 visits) and hasn't already
	// subscribed/dismissed.
	const showBanner = $derived(prefs.visitCount >= 3 && !prefs.newsletterDismissed);
	let bannerEmail = $state('');
	let bannerBusy = $state(false);
	let bannerError = $state('');

	async function submitBanner(e: Event) {
		e.preventDefault();
		if (bannerBusy) return;
		bannerBusy = true;
		bannerError = '';
		const res = await subscribe(bannerEmail);
		bannerBusy = false;
		if (res.ok) {
			prefs.dismissNewsletter();
		} else {
			bannerError = res.reason ?? s.error_generic;
		}
	}
</script>

<svelte:head>
	<title>Peptíð — Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5">
	<header class="mb-6 mt-2">
		<h1 class="text-3xl font-bold tracking-tight">
			{s.home_greeting} <span aria-hidden="true">👋</span>
		</h1>
		<p class="text-muted mt-1 text-sm">{s.home_subtitle}</p>
	</header>

	<!-- Search bar -->
	<div class="relative mb-6">
		<svg
			class="text-muted absolute left-3.5 top-1/2 -translate-y-1/2"
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
			<circle cx="11" cy="11" r="7" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
		<input
			type="search"
			bind:value={query}
			placeholder={s.home_search_placeholder}
			class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-full border bg-transparent py-3 pl-11 pr-4 text-sm outline-none"
			aria-label={s.home_search_placeholder}
		/>
	</div>

	{#if query.trim()}
		<div class="mb-8">
			{#if results.length === 0}
				<p class="text-muted py-8 text-center text-sm">
					{s.home_no_matches} <em>{query}</em>.
				</p>
			{:else}
				<p class="text-muted mb-3 text-xs uppercase tracking-wide">
					{s.home_matches(results.length)}
				</p>
				<ul class="space-y-2">
					{#each results as p (p.id)}
						<li>
							<a
								href={`${pathPrefix}/peptides/${p.id}`}
								class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-4 transition-colors"
							>
								<div class="mb-0.5 font-semibold">{p.name}</div>
								<div class="text-muted text-xs">{p.tagline}</div>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		{#if showBanner}
			<div
				class="border-outline dark:border-outline-dark bg-brand/5 mb-6 rounded-2xl border p-4"
			>
				<div class="mb-3 flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="text-sm font-semibold">{s.newsletter_title}</div>
						<div class="text-muted mt-0.5 text-xs leading-relaxed">
							{s.newsletter_subtitle}
						</div>
					</div>
					<button
						type="button"
						onclick={() => prefs.dismissNewsletter()}
						aria-label={s.newsletter_dismiss}
						class="text-muted hover:text-foreground -mt-1 -mr-1 flex-shrink-0 p-1"
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
				<form onsubmit={submitBanner} class="flex gap-2">
					<input
						type="email"
						bind:value={bannerEmail}
						placeholder={s.newsletter_email_placeholder}
						autocomplete="email"
						required
						class="border-outline dark:border-outline-dark focus:border-brand min-w-0 flex-1 rounded-full border bg-cream dark:bg-ink px-3 py-2 text-sm outline-none"
					/>
					<button
						type="submit"
						disabled={bannerBusy}
						class="bg-brand flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
					>
						{bannerBusy ? '…' : s.newsletter_join}
					</button>
				</form>
				{#if bannerError}
					<p class="mt-2 text-xs text-red-600 dark:text-red-400">{bannerError}</p>
				{/if}
			</div>
		{/if}

		<!-- 4 quick action shortcuts. -->
		<div class="mb-8 grid grid-cols-4 gap-2">
			{#each [{ href: `${pathPrefix}/stacks`, label: s.home_quick_stacks, icon: 'stacks' }, { href: `${pathPrefix}/calculator`, label: s.home_quick_calculator, icon: 'calc' }, { href: `${pathPrefix}/doses`, label: s.home_quick_reminders, icon: 'bell' }, { href: `${pathPrefix}/doses?tab=tracking`, label: s.home_quick_tracking, icon: 'chart' }] as shortcut (shortcut.label)}
				<a
					href={shortcut.href}
					class="border-outline dark:border-outline-dark hover:border-brand flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center"
				>
					{#if shortcut.icon === 'stacks'}
						<svg class="text-brand h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
						</svg>
					{:else if shortcut.icon === 'calc'}
						<svg class="text-brand h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<rect x="4" y="2" width="16" height="20" rx="2" />
							<line x1="8" y1="6" x2="16" y2="6" />
							<line x1="8" y1="11" x2="8" y2="11" />
							<line x1="12" y1="11" x2="12" y2="11" />
							<line x1="16" y1="11" x2="16" y2="11" />
							<line x1="8" y1="15" x2="8" y2="15" />
							<line x1="12" y1="15" x2="12" y2="15" />
							<line x1="16" y1="15" x2="16" y2="19" />
							<line x1="8" y1="19" x2="12" y2="19" />
						</svg>
					{:else if shortcut.icon === 'bell'}
						<svg class="text-brand h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
							<path d="M13.73 21a2 2 0 0 1-3.46 0" />
						</svg>
					{:else}
						<svg class="text-brand h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
							<polyline points="17 6 23 6 23 12" />
						</svg>
					{/if}
					<span class="text-xs font-medium">{shortcut.label}</span>
				</a>
			{/each}
		</div>

		<!-- Categories grid -->
		<section class="mb-8">
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.home_section_categories}</h2>
			<div class="grid grid-cols-2 gap-3">
				{#each categories as cat (cat.id)}
					<a
						href={`${pathPrefix}/categories/${cat.id}`}
						class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-4 transition-colors"
						style={`background-color: ${cat.color}25`}
					>
						<div class="mb-0.5 font-semibold">{cat.name}</div>
						<div class="text-muted text-xs">
							{s.category_count(allPeptides.filter((p) => p.categories.includes(cat.id)).length)}
						</div>
					</a>
				{/each}
			</div>
		</section>

		<!-- Popular peptides -->
		<section>
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">
				{s.home_section_popular}
			</h2>
			<div
				class="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{#each popular as p (p.id)}
					<a
						href={`${pathPrefix}/peptides/${p.id}`}
						class="border-outline dark:border-outline-dark hover:border-brand block w-56 flex-shrink-0 snap-start rounded-2xl border p-4 transition-colors"
					>
						<div class="mb-1 flex items-center justify-between gap-2">
							<span class="truncate font-semibold">{p.name}</span>
							<span class="text-brand flex-shrink-0 font-mono text-xs">★ {p.popularity}</span>
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
				{/each}
			</div>
		</section>
	{/if}
</section>

<script lang="ts">
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	/* News feed — fetches the same manifest the Android app reads, so
	   all three Peptora surfaces stay in lockstep on what articles
	   exist. Articles themselves live on the marketing site (Astro +
	   MDX); we link out rather than render full posts here to keep
	   this app focused on protocol tooling.

	   IMPORTANT: hit the www. host directly. peptora.app 307-redirects
	   to www.peptora.app and the redirect response carries no CORS
	   header, which browsers reject on cross-origin redirects even
	   though the final hop allows the origin. */
	const FEED_URL = 'https://www.peptora.app/api/blog.json';

	interface Article {
		slug: string;
		title: string;
		title_is: string;
		description: string;
		description_is: string;
		date: string;
		category: 'research' | 'protocol' | 'product' | 'industry' | string;
		has_affiliate: boolean;
		url: string;
	}

	const s = $derived(strings[prefs.lang]);

	let articles = $state<Article[]>([]);
	let loading = $state(true);
	let error = $state(false);

	async function load() {
		loading = true;
		error = false;
		try {
			const res = await fetch(FEED_URL, { cache: 'no-cache' });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = await res.json();
			articles = Array.isArray(body?.articles) ? body.articles : [];
		} catch (e) {
			console.error('news feed failed', e);
			error = true;
			articles = [];
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		load();
	});

	// Locale-aware accessors with EN fallback when an IS field is missing.
	function titleOf(a: Article): string {
		return prefs.lang === 'is' ? a.title_is || a.title : a.title;
	}
	function descOf(a: Article): string {
		return prefs.lang === 'is' ? a.description_is || a.description : a.description;
	}

	const categoryLabel = $derived<Record<string, string>>({
		research: s.news_category_research,
		protocol: s.news_category_protocol,
		product: s.news_category_product,
		industry: s.news_category_industry
	});
	// Each category gets its own subtle tint so the feed reads as
	// scannable rather than a wall of grey badges.
	const categoryTint: Record<string, string> = {
		research: '#3B82F6', // blue
		protocol: '#10B981', // emerald
		product: '#F59E0B', // amber
		industry: '#A855F7' // purple
	};

	function formatDate(iso: string): string {
		try {
			const d = new Date(iso);
			return d.toLocaleDateString(prefs.lang === 'is' ? 'is-IS' : 'en-US', {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>{s.news_title} · Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5">
	<header class="mb-6 mt-2">
		<h1 class="text-3xl font-bold tracking-tight">{s.news_title}</h1>
		<p class="text-muted mt-1 text-sm">{s.news_subtitle}</p>
	</header>

	{#if loading}
		<!-- Skeleton — three pulsing placeholder cards to fill the fold
		     while the manifest loads. -->
		<ul class="space-y-3">
			{#each Array(3) as _, i (i)}
				<li
					class="border-outline dark:border-outline-dark animate-pulse rounded-2xl border p-5"
				>
					<div class="bg-outline mb-3 h-4 w-3/4 rounded"></div>
					<div class="bg-outline mb-1.5 h-3 w-full rounded"></div>
					<div class="bg-outline h-3 w-5/6 rounded"></div>
				</li>
			{/each}
		</ul>
	{:else if error}
		<div
			class="border-outline dark:border-outline-dark rounded-2xl border border-dashed p-8 text-center"
		>
			<p class="font-medium">{s.news_error_title}</p>
			<p class="text-muted mt-1 text-sm">{s.news_error_subtitle}</p>
			<button
				type="button"
				onclick={load}
				class="border-outline dark:border-outline-dark hover:border-brand mt-4 rounded-full border px-5 py-2 text-sm font-medium"
			>
				{s.news_retry}
			</button>
		</div>
	{:else if articles.length === 0}
		<div
			class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-8 text-center"
		>
			<p class="text-sm">{s.news_empty_title}</p>
			<p class="mt-1 text-xs">{s.news_empty_subtitle}</p>
		</div>
	{:else}
		<ul class="space-y-3">
			{#each articles as a (a.slug)}
				{@const tint = categoryTint[a.category] ?? '#94A3B8'}
				<li>
					<a
						href={a.url}
						target="_blank"
						rel="noopener noreferrer"
						class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-5 transition-colors"
					>
						<div class="mb-2 flex items-center gap-2">
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium"
								style="background-color: {tint}25; color: {tint};"
							>
								{categoryLabel[a.category] ?? a.category}
							</span>
							<span class="text-muted text-xs">{formatDate(a.date)}</span>
						</div>
						<h2 class="mb-1 text-base font-semibold leading-snug">{titleOf(a)}</h2>
						<p class="text-muted line-clamp-3 text-sm leading-relaxed">{descOf(a)}</p>
						<p class="text-brand mt-3 inline-flex items-center gap-1 text-xs font-medium">
							{s.news_read_more}
							<svg
								class="h-3 w-3"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<line x1="7" y1="17" x2="17" y2="7" />
								<polyline points="7 7 17 7 17 17" />
							</svg>
						</p>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

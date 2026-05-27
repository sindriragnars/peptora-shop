<script lang="ts">
	import { formatArticleDate } from '$lib/news';

	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const articles = $derived(data.articles);
</script>

<svelte:head>
	<title>Fréttir · {tenant.name}</title>
</svelte:head>

<section class="mx-auto max-w-3xl p-5">
	<h1 class="mb-6 mt-2 text-3xl font-bold tracking-tight">Fréttir</h1>

	{#if articles.length === 0}
		<div class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted">Engar fréttir komnar inn enn.</p>
		</div>
	{:else}
		<ul class="space-y-4">
			{#each articles as article (article.id)}
				<li>
					<a
						href="{pathPrefix}/news/{article.id}"
						class="border-outline hover:border-brand block overflow-hidden rounded-2xl border bg-white transition-colors"
					>
						{#if article.image}
							<div class="bg-cream-dark aspect-[16/9]">
								<img
									src={article.image}
									alt=""
									class="h-full w-full object-cover"
									loading="lazy"
								/>
							</div>
						{/if}
						<div class="p-5">
							<div class="text-muted mb-1 text-xs">{formatArticleDate(article.date)}</div>
							<h2 class="text-lg font-semibold leading-tight">{article.title}</h2>
							{#if article.excerpt}
								<p class="text-muted mt-2 line-clamp-3 text-sm">{article.excerpt}</p>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>

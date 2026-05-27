<script lang="ts">
	import { formatArticleDate } from '$lib/news';
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
</script>

<svelte:head>
	<title>Fréttir · {tenant.name} admin</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-6 py-8">
	<div class="mb-6 flex items-baseline justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Fréttir</h1>
			<p class="text-muted mt-1 text-sm">
				{data.articles.length} skráðar — uppfært strax úr GitHub.
			</p>
		</div>
		<a
			href="{pathPrefix}/admin/news/new"
			class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-white transition-colors"
		>
			+ Ný frétt
		</a>
	</div>

	{#if data.articles.length === 0}
		<section class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted">Engar fréttir skráðar enn. Smelltu á "+ Ný frétt" til að birta þá fyrstu.</p>
		</section>
	{:else}
		<div class="border-outline overflow-hidden rounded-2xl border bg-white">
			<table class="w-full text-sm">
				<thead class="bg-cream-dark/40">
					<tr>
						<th class="text-muted px-4 py-3 text-left font-medium">Fyrirsögn</th>
						<th class="text-muted px-4 py-3 text-left font-medium">Dagsetning</th>
						<th class="text-muted px-4 py-3 text-left font-medium">Featured</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.articles as article (article.id)}
						<tr class="border-outline border-t">
							<td class="px-4 py-3">
								<a href="{pathPrefix}/admin/news/{article.id}" class="hover:text-brand font-medium">
									{article.title}
								</a>
								{#if article.excerpt}
									<div class="text-muted mt-0.5 line-clamp-1 text-xs">{article.excerpt}</div>
								{/if}
							</td>
							<td class="text-muted px-4 py-3 font-mono text-xs">
								{article.date ? formatArticleDate(article.date) : '—'}
							</td>
							<td class="px-4 py-3">
								{#if article.featured}
									<span class="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">★</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<a href="{pathPrefix}/admin/news/{article.id}" class="text-muted hover:text-ink text-xs">
									Breyta →
								</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>

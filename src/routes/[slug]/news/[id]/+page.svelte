<script lang="ts">
	import { formatArticleDate } from '$lib/news';
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const article = $derived(data.article);
</script>

<svelte:head>
	<title>{article.title} · {tenant.name}</title>
	{#if article.excerpt}
		<meta name="description" content={article.excerpt} />
	{/if}
</svelte:head>

<article class="mx-auto max-w-3xl px-5 py-8">
	<nav class="mb-6 text-sm">
		<a href="{pathPrefix}/news" class="text-muted hover:text-ink">← Allar fréttir</a>
	</nav>

	{#if article.image}
		<div class="border-outline bg-cream-dark mb-6 aspect-[16/9] overflow-hidden rounded-2xl border">
			<img src={article.image} alt="" class="h-full w-full object-cover" />
		</div>
	{/if}

	<div class="text-muted mb-2 text-xs">{formatArticleDate(article.date)}</div>
	<h1 class="mb-6 text-3xl font-bold tracking-tight">{article.title}</h1>

	{#if article.excerpt}
		<p class="text-muted mb-6 text-lg leading-relaxed">{article.excerpt}</p>
	{/if}

	<!-- Markdown body, rendered server-side. Tailwind prose plugin isn't
	     wired so we lean on default browser styles plus a few targeted
	     overrides via the parent class. -->
	<div
		class="prose-content space-y-4 leading-relaxed
			[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold
			[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold
			[&_a]:text-brand [&_a]:underline
			[&_ul]:list-disc [&_ul]:pl-5
			[&_ol]:list-decimal [&_ol]:pl-5
			[&_strong]:font-semibold"
	>
		{@html article.bodyHtml}
	</div>
</article>

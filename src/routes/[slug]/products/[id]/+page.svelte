<script lang="ts">
	import { goto } from '$app/navigation';
	import { formatPriceISK } from '$lib/products';
	import { getCartStore } from '$lib/cart.svelte';
	let { data } = $props();
	const product = $derived(data.product);
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const cart = $derived(getCartStore(tenant.slug));

	let adding = $state(false);

	async function addToCart() {
		if (product.stock === 'out' || adding) return;
		adding = true;
		try {
			await cart.add(product.id, 1);
			// Take the user to the cart so they see the item land — common
			// pattern for low-volume catalogs where finding the just-added
			// item back in a full cart isn't obvious.
			await goto(`${pathPrefix}/cart`);
		} finally {
			adding = false;
		}
	}

	const stockLabel: Record<string, string> = {
		'in-stock': 'Á lager',
		low: 'Fáir eftir',
		out: 'Uppselt'
	};
</script>

<svelte:head>
	<title>{product.title} · {tenant.name}</title>
	<meta name="description" content={product.description} />
</svelte:head>

<main class="mx-auto max-w-4xl px-6 py-8">
	<nav class="mb-6 text-sm">
		<a href={pathPrefix || '/'} class="text-muted hover:text-ink">← Til baka í verslun</a>
	</nav>

	<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
		<!-- Image -->
		<div class="border-outline aspect-square overflow-hidden rounded-2xl border bg-white">
			{#if product.images[0]}
				<img src={product.images[0]} alt="" class="h-full w-full object-cover" />
			{/if}
		</div>

		<!-- Product info -->
		<div class="flex flex-col">
			<p class="text-muted mb-1 text-xs font-medium uppercase tracking-wide">
				{product.category}
			</p>
			<h1 class="mb-3 text-3xl font-bold tracking-tight">{product.title}</h1>
			<p class="text-muted mb-4 text-base">{product.description}</p>

			<div class="mb-6 flex items-center gap-4">
				<span class="font-mono text-2xl font-medium">
					{formatPriceISK(product.priceISK)}
				</span>
				<span
					class="rounded-full px-2.5 py-1 text-xs font-medium"
					class:bg-emerald-100={product.stock === 'in-stock'}
					class:text-emerald-800={product.stock === 'in-stock'}
					class:bg-amber-100={product.stock === 'low'}
					class:text-amber-800={product.stock === 'low'}
					class:bg-gray-200={product.stock === 'out'}
					class:text-gray-700={product.stock === 'out'}
				>
					{stockLabel[product.stock]}
				</span>
			</div>

			<button
				type="button"
				onclick={addToCart}
				disabled={product.stock === 'out' || adding}
				class="bg-brand hover:bg-brand-dark inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-base font-medium text-white transition-colors disabled:opacity-50"
			>
				{#if product.stock === 'out'}
					Uppselt
				{:else if adding}
					Bæti í körfu…
				{:else}
					Bæta í körfu
				{/if}
			</button>

			<!-- Spec table -->
			<dl class="border-outline mt-8 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-6 text-sm">
				{#if product.sku}
					<dt class="text-muted">SKU</dt>
					<dd class="font-mono">{product.sku}</dd>
				{/if}
				{#if product.weightGrams}
					<dt class="text-muted">Þyngd</dt>
					<dd>{product.weightGrams} g</dd>
				{/if}
				<dt class="text-muted">Flokkur</dt>
				<dd>{product.category}</dd>
			</dl>
		</div>
	</div>

	{#if product.bodyHtml}
		<article
			class="prose prose-sm mt-12 max-w-prose [&>h1]:text-2xl [&>h1]:font-bold [&>h2]:mt-6 [&>h2]:text-lg [&>h2]:font-semibold [&>ul]:list-disc [&>ul]:pl-6 [&>p]:mt-3"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html product.bodyHtml}
		</article>
	{/if}
</main>

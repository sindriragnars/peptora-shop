<script lang="ts">
	import { formatPriceISK, type Product } from '$lib/products';
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const products = $derived(data.products);

	// Group products by category for natural sectioning. Keeps the storefront
	// scannable as the catalog grows past ~20 items. Order within each
	// category is preserved from listProducts (manual `order` field).
	const grouped = $derived.by(() => {
		const map = new Map<string, Product[]>();
		for (const p of products) {
			const list = map.get(p.category) ?? [];
			list.push(p);
			map.set(p.category, list);
		}
		return Array.from(map.entries());
	});

	const categoryLabel: Record<string, string> = {
		peptides: 'Peptíð',
		stack: 'Stack',
		supplies: 'Aukabúnaður',
		general: 'Almennt'
	};

	const stockLabel: Record<string, string> = {
		'in-stock': 'Á lager',
		low: 'Fáir eftir',
		out: 'Uppselt'
	};
</script>

<main class="mx-auto max-w-4xl px-6 py-12">
	<h1 class="mb-3 text-4xl font-bold tracking-tight">{tenant.name}</h1>
	<p class="text-muted mb-12 text-lg">{tenant.tagline}</p>

	{#if products.length === 0}
		<section class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted">Engar vörur enn skráðar.</p>
		</section>
	{:else}
		{#each grouped as [category, items] (category)}
			<section class="mb-12">
				<h2 class="text-muted mb-4 text-xs font-medium uppercase tracking-wide">
					{categoryLabel[category] ?? category}
				</h2>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each items as product (product.id)}
						<a
							href="/{tenant.slug}/products/{product.id}"
							class="border-outline hover:border-brand group flex flex-col overflow-hidden rounded-2xl border bg-white transition-colors"
						>
							<div class="bg-cream-dark aspect-square">
								{#if product.images[0]}
									<img
										src={product.images[0]}
										alt=""
										class="h-full w-full object-cover"
										loading="lazy"
									/>
								{/if}
							</div>
							<div class="flex flex-1 flex-col p-4">
								<h3 class="font-semibold leading-tight">{product.title}</h3>
								<p class="text-muted mt-1 line-clamp-2 text-sm">{product.description}</p>
								<div class="mt-auto flex items-baseline justify-between pt-3">
									<span class="font-mono text-sm font-medium">
										{formatPriceISK(product.priceISK)}
									</span>
									{#if product.stock !== 'in-stock'}
										<span
											class="rounded-full px-2 py-0.5 text-xs font-medium"
											class:bg-amber-100={product.stock === 'low'}
											class:text-amber-800={product.stock === 'low'}
											class:bg-gray-200={product.stock === 'out'}
											class:text-gray-700={product.stock === 'out'}
										>
											{stockLabel[product.stock]}
										</span>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			</section>
		{/each}
	{/if}
</main>

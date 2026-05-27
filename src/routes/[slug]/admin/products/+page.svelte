<script lang="ts">
	import { formatPriceISK } from '$lib/products';

	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);

	const stockLabel: Record<string, string> = {
		'in-stock': 'Á lager',
		low: 'Fáir eftir',
		out: 'Uppselt'
	};
	const stockColor: Record<string, string> = {
		'in-stock': 'bg-emerald-100 text-emerald-800',
		low: 'bg-amber-100 text-amber-800',
		out: 'bg-gray-200 text-gray-700'
	};
</script>

<svelte:head>
	<title>Vörur · {tenant.name} admin</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="mx-auto max-w-6xl px-6 py-8">
	<div class="mb-6 flex items-baseline justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Vörur</h1>
			<p class="text-muted mt-1 text-sm">{data.products.length} skráðar — uppfært strax úr GitHub.</p>
		</div>
		<a
			href="{pathPrefix}/admin/products/new"
			class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-white transition-colors"
		>
			+ Ný vara
		</a>
	</div>

	{#if data.products.length === 0}
		<section class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted">Engar vörur skráðar enn.</p>
		</section>
	{:else}
		<div class="border-outline overflow-hidden rounded-2xl border bg-white">
			<table class="w-full text-sm">
				<thead class="bg-cream-dark/40">
					<tr>
						<th class="px-4 py-3 text-left font-medium text-muted">Vara</th>
						<th class="px-4 py-3 text-left font-medium text-muted">Flokkur</th>
						<th class="px-4 py-3 text-left font-medium text-muted">Staða</th>
						<th class="px-4 py-3 text-right font-medium text-muted">Verð</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.products as p (p.id)}
						<tr class="border-outline border-t">
							<td class="px-4 py-3">
								<a href="{pathPrefix}/admin/products/{p.id}" class="hover:underline">
									<span class="font-medium">{p.title}</span>
									{#if p.featured}
										<span class="text-brand ml-1 text-xs">★</span>
									{/if}
									<p class="text-muted font-mono text-xs">{p.id}</p>
								</a>
							</td>
							<td class="px-4 py-3 text-muted">{p.category}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {stockColor[p.stock] ?? ''}">
									{stockLabel[p.stock] ?? p.stock}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-mono">{formatPriceISK(p.priceISK)}</td>
							<td class="px-4 py-3 text-right">
								<a href="{pathPrefix}/admin/products/{p.id}" class="text-brand text-xs hover:underline">Breyta</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>

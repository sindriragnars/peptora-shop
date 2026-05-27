<script lang="ts">
	import { formatPriceISK } from '$lib/products';
	import { getCartStore } from '$lib/cart.svelte';
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const cart = $derived(getCartStore(tenant.slug));

	// Resolve each cart line to its current product. The product catalog
	// is loaded by the parent layout (server-side) so the markdown parser
	// never ships to the browser. Filtered for products that disappeared
	// from the catalog between add and view.
	const lines = $derived(
		cart.items
			.map((item) => ({
				item,
				product: data.products.find((p) => p.id === item.productId) ?? null
			}))
			.filter((l): l is { item: typeof l.item; product: NonNullable<typeof l.product> } =>
				l.product !== null
			)
	);

	const subtotal = $derived(lines.reduce((sum, l) => sum + l.product.priceISK * l.item.qty, 0));

	// Shipping is flat-rate per tenant, waived above a tenant-configured
	// threshold. Both numbers come from tenant.json.
	const shipping = $derived(
		subtotal >= tenant.shipping.freeAboveISK ? 0 : tenant.shipping.flatRateISK
	);
	const total = $derived(subtotal + shipping);
</script>

<svelte:head>
	<title>Karfa · {tenant.name}</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<h1 class="mb-6 text-3xl font-bold tracking-tight">Karfa</h1>

	{#if !cart.loaded}
		<p class="text-muted">Sæki körfu…</p>
	{:else if cart.isEmpty}
		<section class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted mb-4">Karfan er tóm.</p>
			<a
				href={pathPrefix || '/'}
				class="border-outline hover:border-brand inline-flex rounded-full border px-5 py-2 text-sm transition-colors"
			>
				Sjá vörur
			</a>
		</section>
	{:else}
		<section class="space-y-3">
			{#each lines as { item, product } (item.id)}
				<article class="border-outline flex gap-4 rounded-2xl border bg-white p-4">
					<div class="border-outline bg-cream-dark h-20 w-20 shrink-0 overflow-hidden rounded-lg">
						{#if product.images[0]}
							<img src={product.images[0]} alt="" class="h-full w-full object-cover" />
						{/if}
					</div>

					<div class="flex flex-1 flex-col">
						<a href="{pathPrefix}/products/{product.id}" class="font-semibold hover:underline">
							{product.title}
						</a>
						<p class="text-muted font-mono text-sm">{formatPriceISK(product.priceISK)} / stk</p>

						<div class="mt-auto flex items-center justify-between pt-2">
							<!-- qty stepper -->
							<div class="border-outline inline-flex items-center rounded-full border text-sm">
								<button
									type="button"
									aria-label="Minnka magn"
									class="px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40"
									disabled={item.qty <= 1}
									onclick={() => cart.setQty(product.id, item.qty - 1)}
								>
									−
								</button>
								<span class="min-w-8 px-2 text-center font-medium">{item.qty}</span>
								<button
									type="button"
									aria-label="Auka magn"
									class="px-3 py-1.5 hover:bg-gray-100"
									onclick={() => cart.setQty(product.id, item.qty + 1)}
								>
									+
								</button>
							</div>

							<button
								type="button"
								class="text-muted hover:text-ink text-xs"
								onclick={() => cart.remove(product.id)}
							>
								Fjarlægja
							</button>
						</div>
					</div>

					<div class="text-right font-mono font-medium">
						{formatPriceISK(product.priceISK * item.qty)}
					</div>
				</article>
			{/each}
		</section>

		<!-- Summary -->
		<section class="border-outline mt-8 rounded-2xl border bg-white p-6">
			<dl class="space-y-2 text-sm">
				<div class="flex justify-between">
					<dt class="text-muted">Vörur</dt>
					<dd class="font-mono">{formatPriceISK(subtotal)}</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-muted">
						Sending
						{#if shipping === 0}
							<span class="text-emerald-700">— frítt yfir {formatPriceISK(tenant.shipping.freeAboveISK)}</span>
						{/if}
					</dt>
					<dd class="font-mono">{formatPriceISK(shipping)}</dd>
				</div>
				<div class="border-outline mt-2 flex justify-between border-t pt-3 text-base font-semibold">
					<dt>Samtals</dt>
					<dd class="font-mono">{formatPriceISK(total)}</dd>
				</div>
			</dl>

			<a
				href="{pathPrefix}/checkout"
				class="bg-brand hover:bg-brand-dark mt-6 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-base font-medium text-white transition-colors"
			>
				Halda áfram að greiðslu
			</a>
		</section>
	{/if}
</main>

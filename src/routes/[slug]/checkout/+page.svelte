<script lang="ts">
	import { formatPriceISK } from '$lib/products';
	import { getCartStore } from '$lib/cart.svelte';
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const cart = $derived(getCartStore(tenant.slug));

	// Product catalog comes from the parent layout's server load so the
	// markdown parser never reaches the client bundle.
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

	let shippingOption = $state(tenant.shipping.options[0] ?? '');

	const shipping = $derived(
		subtotal >= tenant.shipping.freeAboveISK ? 0 : tenant.shipping.flatRateISK
	);
	const total = $derived(subtotal + shipping);

	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let address = $state('');
	let postalCode = $state('');
	let city = $state('');
	let notes = $state('');

	let submitting = $state(false);
	let submitError = $state('');

	async function onSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (submitting || cart.isEmpty) return;
		submitting = true;
		submitError = '';
		try {
			const res = await fetch('/api/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tenantSlug: tenant.slug,
					items: cart.items.map((it) => ({ productId: it.productId, qty: it.qty })),
					customer: { name, email, phone, address, postalCode, city, notes },
					shippingOption
				})
			});
			if (!res.ok) {
				const errText = await res.text();
				throw new Error(errText || `HTTP ${res.status}`);
			}
			const data = (await res.json()) as { orderId: string; checkoutUrl: string };
			// Redirect to Revolut hosted checkout. We deliberately leave
			// the cart in place — it gets cleared on the success page
			// once we know payment went through.
			window.location.href = data.checkoutUrl;
		} catch (err) {
			submitError = err instanceof Error ? err.message : 'Greiðsla mistókst. Reyndu aftur.';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Greiðsla · {tenant.name}</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<h1 class="mb-6 text-3xl font-bold tracking-tight">Greiðsla</h1>

	{#if !cart.loaded}
		<p class="text-muted">Sæki körfu…</p>
	{:else if cart.isEmpty}
		<section class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted mb-4">Þú ert ekki með neinar vörur í körfu.</p>
			<a
				href="/{tenant.slug}"
				class="border-outline hover:border-brand inline-flex rounded-full border px-5 py-2 text-sm transition-colors"
			>
				Sjá vörur
			</a>
		</section>
	{:else}
		<form onsubmit={onSubmit} class="grid gap-6 lg:grid-cols-3 lg:gap-10">
			<!-- Customer details -->
			<div class="lg:col-span-2">
				<h2 class="mb-4 text-xs font-medium uppercase tracking-wide text-muted">
					Upplýsingar um þig
				</h2>
				<div class="space-y-3">
					<label class="block">
						<span class="text-muted mb-1 block text-xs">Nafn</span>
						<input
							type="text"
							bind:value={name}
							required
							autocomplete="name"
							class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:outline-none"
						/>
					</label>
					<label class="block">
						<span class="text-muted mb-1 block text-xs">Netfang</span>
						<input
							type="email"
							bind:value={email}
							required
							autocomplete="email"
							class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:outline-none"
						/>
					</label>
					<label class="block">
						<span class="text-muted mb-1 block text-xs">Símanúmer</span>
						<input
							type="tel"
							bind:value={phone}
							required
							autocomplete="tel"
							class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:outline-none"
						/>
					</label>
				</div>

				<h2 class="text-muted mb-4 mt-8 text-xs font-medium uppercase tracking-wide">
					Sendingarheimilisfang
				</h2>
				<div class="space-y-3">
					<label class="block">
						<span class="text-muted mb-1 block text-xs">Götuheiti og húsnúmer</span>
						<input
							type="text"
							bind:value={address}
							required
							autocomplete="street-address"
							class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:outline-none"
						/>
					</label>
					<div class="grid grid-cols-2 gap-3">
						<label class="block">
							<span class="text-muted mb-1 block text-xs">Póstnúmer</span>
							<input
								type="text"
								bind:value={postalCode}
								required
								inputmode="numeric"
								autocomplete="postal-code"
								class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:outline-none"
							/>
						</label>
						<label class="block">
							<span class="text-muted mb-1 block text-xs">Staður</span>
							<input
								type="text"
								bind:value={city}
								required
								autocomplete="address-level2"
								class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-base focus:outline-none"
							/>
						</label>
					</div>
				</div>

				<h2 class="text-muted mb-4 mt-8 text-xs font-medium uppercase tracking-wide">
					Sendingarmáti
				</h2>
				<div class="space-y-2">
					{#each tenant.shipping.options as option (option)}
						<label
							class="border-outline hover:border-brand flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3"
						>
							<input type="radio" name="shipping" value={option} bind:group={shippingOption} />
							<span class="text-sm">{option}</span>
						</label>
					{/each}
				</div>

				<label class="mt-6 block">
					<span class="text-muted mb-1 block text-xs">Athugasemd (valfrjálst)</span>
					<textarea
						bind:value={notes}
						rows="2"
						class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none"
					></textarea>
				</label>
			</div>

			<!-- Order summary -->
			<aside class="lg:col-span-1">
				<div class="border-outline sticky top-6 rounded-2xl border bg-white p-5">
					<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Yfirlit</h2>
					<ul class="mb-4 space-y-2 text-sm">
						{#each lines as { item, product } (item.id)}
							<li class="flex justify-between">
								<span class="pr-2">
									{product.title}
									<span class="text-muted">× {item.qty}</span>
								</span>
								<span class="font-mono">{formatPriceISK(product.priceISK * item.qty)}</span>
							</li>
						{/each}
					</ul>
					<dl class="border-outline space-y-1.5 border-t pt-3 text-sm">
						<div class="flex justify-between">
							<dt class="text-muted">Vörur</dt>
							<dd class="font-mono">{formatPriceISK(subtotal)}</dd>
						</div>
						<div class="flex justify-between">
							<dt class="text-muted">Sending</dt>
							<dd class="font-mono">{formatPriceISK(shipping)}</dd>
						</div>
						<div class="mt-2 flex justify-between text-base font-semibold">
							<dt>Samtals</dt>
							<dd class="font-mono">{formatPriceISK(total)}</dd>
						</div>
					</dl>

					{#if submitError}
						<p class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{submitError}</p>
					{/if}

					<button
						type="submit"
						disabled={submitting}
						class="bg-brand hover:bg-brand-dark mt-5 inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-base font-medium text-white transition-colors disabled:opacity-50"
					>
						{submitting ? 'Tengist Revolut…' : 'Greiða með Revolut'}
					</button>
					<p class="text-muted mt-2 text-center text-xs">
						Þú verður færð/-ur yfir á Revolut til að klára greiðsluna.
					</p>
				</div>
			</aside>
		</form>
	{/if}
</main>

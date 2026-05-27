<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getCartStore } from '$lib/cart.svelte';
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const cart = $derived(getCartStore(tenant.slug));

	const orderId = $derived(page.url.searchParams.get('orderId') ?? '');

	// Revolut bounced the user back here after successful payment. Clear
	// the cart now — the order is captured on the server and an email
	// receipt is on its way (or already arrived).
	onMount(async () => {
		await cart.clear();
	});
</script>

<svelte:head>
	<title>Pöntun staðfest · {tenant.name}</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16 text-center">
	<div
		class="mx-auto mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full"
		style="background: color-mix(in srgb, var(--color-brand) 12%, transparent);"
	>
		<svg
			class="text-brand h-8 w-8"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<polyline points="5 12 10 17 19 8" />
		</svg>
	</div>

	<h1 class="mb-3 text-3xl font-bold tracking-tight">Takk fyrir pöntunina</h1>
	<p class="text-muted mb-8">
		Greiðslan er móttekin. Þú færð staðfestingu í tölvupósti innan skamms.
	</p>

	{#if orderId}
		<p class="text-muted mb-8 text-sm">
			Pöntunarnúmer: <code class="font-mono">{orderId.slice(0, 8)}</code>
		</p>
	{/if}

	<a
		href={pathPrefix || '/'}
		class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-medium text-white transition-colors"
	>
		Aftur í verslun
	</a>
</main>

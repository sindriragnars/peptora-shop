<script lang="ts">
	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
</script>

<svelte:head>
	<title>Greiðsla aflýst · {tenant.name}</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16 text-center">
	<h1 class="mb-3 text-3xl font-bold tracking-tight">Greiðsla aflýst</h1>
	<p class="text-muted mb-8">
		Engin krafa var gerð á kortið þitt. Karfan er enn til staðar — þú getur reynt aftur eða breytt
		innihaldi.
	</p>

	<div class="flex justify-center gap-3">
		<a
			href="{pathPrefix}/cart"
			class="border-outline hover:border-brand inline-flex rounded-full border px-5 py-3 text-sm transition-colors"
		>
			Sjá körfu
		</a>
		<a
			href="{pathPrefix}/checkout"
			class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-medium text-white transition-colors"
		>
			Reyna aftur
		</a>
	</div>
</main>

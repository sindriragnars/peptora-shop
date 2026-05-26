<script lang="ts">
	let { data } = $props();
	const tenant = $derived(data.tenant);
</script>

<main class="mx-auto max-w-4xl px-6 py-12">
	<p class="text-brand mb-2 text-xs font-medium uppercase tracking-wide">Sýnishorn-verslun</p>
	<h1 class="mb-3 text-4xl font-bold tracking-tight">{tenant.name}</h1>
	<p class="text-muted mb-12 text-lg">{tenant.tagline}</p>

	<section
		class="border-outline rounded-2xl border p-8"
		style="background: color-mix(in srgb, var(--color-brand) 5%, transparent);"
	>
		<h2 class="mb-2 font-semibold">Phase 0 placeholder</h2>
		<p class="text-muted text-sm">
			Tenant config hlaðin og branding virk (look at <code class="font-mono">--color-brand</code> →
			{tenant.theme.brand}). Phase 1 bætir við Decap CMS product collection og raunverulegum
			vörulistunum á þessari síðu.
		</p>
		<dl class="text-muted mt-6 grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
			<dt class="font-medium">Slug</dt>
			<dd class="font-mono">{tenant.slug}</dd>
			<dt class="font-medium">Flat-rate sending</dt>
			<dd>{tenant.shipping.flatRateISK.toLocaleString('is-IS')} kr.</dd>
			<dt class="font-medium">Frítt yfir</dt>
			<dd>{tenant.shipping.freeAboveISK.toLocaleString('is-IS')} kr.</dd>
			<dt class="font-medium">Revolut env-vörp</dt>
			<dd class="font-mono">{tenant.revolut.apiKeyRef}</dd>
		</dl>
	</section>
</main>

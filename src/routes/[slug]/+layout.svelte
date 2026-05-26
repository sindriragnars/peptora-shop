<script lang="ts">
	let { data, children } = $props();
	const tenant = $derived(data.tenant);
	// Per-tenant theme overrides via inline CSS variables on the root.
	// This way every Tailwind class that resolves `var(--color-brand)`
	// picks up the tenant's brand colour without any class rewriting.
	const themeStyle = $derived(
		`--color-brand: ${tenant.theme.brand}; --color-accent: ${tenant.theme.accent};`
	);
</script>

<svelte:head>
	<title>{tenant.name}</title>
	<meta name="theme-color" content={tenant.theme.brand} />
</svelte:head>

<div style={themeStyle} class="min-h-screen">
	<header class="border-outline border-b">
		<div class="mx-auto flex max-w-4xl items-baseline justify-between px-6 py-5">
			<a href="/{tenant.slug}" class="text-xl font-semibold tracking-tight">{tenant.name}</a>
			<nav class="text-muted flex gap-6 text-sm">
				<a href="/{tenant.slug}" class="hover:text-ink">Vörur</a>
				<a href="/{tenant.slug}/cart" class="hover:text-ink">Karfa</a>
			</nav>
		</div>
	</header>

	{@render children()}

	<footer class="border-outline mt-20 border-t">
		<div class="text-muted mx-auto max-w-4xl px-6 py-8 text-xs">
			<p class="font-medium">{tenant.name}</p>
			<p>{tenant.contact.address}</p>
			<p>
				<a href="mailto:{tenant.contact.email}" class="hover:text-ink">{tenant.contact.email}</a>
				· {tenant.contact.phone}
			</p>
			{#if tenant.contact.vskNumber}
				<p class="mt-1 font-mono">{tenant.contact.vskNumber}</p>
			{/if}
		</div>
	</footer>
</div>

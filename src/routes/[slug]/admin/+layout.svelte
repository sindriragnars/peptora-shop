<script lang="ts">
	import { page } from '$app/state';
	let { data, children } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived<string>(data.pathPrefix ?? '');

	// Active-tab match keys off the path *relative to* pathPrefix so the
	// same logic works under subdomain and /<slug> URLs.
	const relPath = $derived.by(() => {
		const p = page.url.pathname;
		if (!pathPrefix) return p;
		if (p === pathPrefix) return '/';
		if (p.startsWith(pathPrefix + '/')) return p.slice(pathPrefix.length);
		return p;
	});

	const tabs = $derived([
		{
			href: `${pathPrefix}/admin`,
			label: 'Yfirlit',
			match: (p: string) => p === '/admin'
		},
		{
			href: `${pathPrefix}/admin/products`,
			label: 'Vörur',
			match: (p: string) => p.startsWith('/admin/products')
		},
		{
			href: `${pathPrefix}/admin/orders`,
			label: 'Pantanir',
			match: (p: string) => p.startsWith('/admin/orders')
		}
	] as const);
</script>

<svelte:head>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<!-- Admin chrome: tenant name + nav tabs + "Sjá verslun" out-link.
     Lives outside the per-tenant brand colour treatment so the
     dashboard reads as an operator surface, not part of the
     storefront. The +layout.svelte for [slug] already hides the
     primary bottom nav on /admin paths, so the dashboard owns the
     whole viewport. -->
<div class="min-h-screen bg-cream-dark/30">
	<header class="border-outline border-b bg-white">
		<div class="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
			<div class="min-w-0">
				<div class="text-muted text-xs uppercase tracking-wide">Admin</div>
				<div class="truncate text-lg font-semibold">{tenant.name}</div>
			</div>
			<a
				href={pathPrefix || '/'}
				class="text-muted hover:text-ink hidden text-sm sm:inline"
			>
				← Sjá verslun
			</a>
		</div>
		<nav class="mx-auto max-w-6xl px-6">
			<ul class="-mb-px flex gap-6 text-sm">
				{#each tabs as tab (tab.href)}
					{@const active = tab.match(relPath)}
					<li>
						<a
							href={tab.href}
							class="inline-block border-b-2 py-3 transition-colors {active
								? 'border-brand text-ink font-medium'
								: 'border-transparent text-muted hover:text-ink'}"
						>
							{tab.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</header>

	{@render children()}
</div>

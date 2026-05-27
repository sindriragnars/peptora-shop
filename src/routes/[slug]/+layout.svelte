<script lang="ts">
	import { page } from '$app/state';
	import { getCartStore } from '$lib/cart.svelte';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';
	let { data, children } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const cart = $derived(getCartStore(tenant.slug));
	const s = $derived(strings[prefs.lang]);

	// Per-tenant theme overrides via inline CSS variables on the root.
	// Tailwind classes that resolve `var(--color-brand)` pick up the
	// tenant's brand colour without any class rewriting.
	const themeStyle = $derived(
		`--color-brand: ${tenant.theme.brand}; --color-accent: ${tenant.theme.accent};`
	);

	// Path relative to the pathPrefix (so "/peptides/foo" matches whether
	// we're on a subdomain or under /<slug>). Falsy prefix → use raw path.
	const relPath = $derived.by(() => {
		const p = page.url.pathname;
		if (!pathPrefix) return p;
		if (p === pathPrefix) return '/';
		if (p.startsWith(pathPrefix + '/')) return p.slice(pathPrefix.length);
		return p;
	});

	// 6-tab bottom nav: shop landing + peptide library + stacks + doses + news + settings.
	// /admin is intentionally hidden — tenants reach it via direct URL.
	const tabs = $derived([
		{ href: pathPrefix || '/', label: s.nav_peptides, icon: 'home', match: (p: string) => p === '/' || p.startsWith('/peptides/') || p.startsWith('/categories/') },
		{ href: `${pathPrefix}/stacks`, label: s.nav_stacks, icon: 'stacks', match: (p: string) => p.startsWith('/stacks') },
		{ href: `${pathPrefix}/doses`, label: s.nav_doses, icon: 'doses', match: (p: string) => p.startsWith('/doses') },
		{ href: `${pathPrefix}/shop`, label: s.nav_shop, icon: 'shop', match: (p: string) => p.startsWith('/shop') || p.startsWith('/products/') || p.startsWith('/cart') },
		{ href: `${pathPrefix}/news`, label: s.nav_news, icon: 'news', match: (p: string) => p.startsWith('/news') },
		{ href: `${pathPrefix}/settings`, label: s.nav_settings, icon: 'settings', match: (p: string) => p.startsWith('/settings') }
	] as const);

	// Hide nav while in checkout / admin so the user can focus.
	const showNav = $derived(
		!relPath.startsWith('/checkout') && !relPath.startsWith('/admin')
	);
</script>

<svelte:head>
	<title>{tenant.name}</title>
	<meta name="theme-color" content={tenant.theme.brand} />
</svelte:head>

<div style={themeStyle} class="min-h-screen flex flex-col">
	<!-- Header: tenant name removed for now (TBD: logo or nothing).
	     Cart link stays right-aligned so the count badge is reachable. -->
	<header class="border-outline border-b">
		<div class="mx-auto flex max-w-4xl items-baseline justify-end px-6 py-5">
			<nav class="text-muted flex items-center gap-6 text-sm">
				<a
					href="{pathPrefix}/cart"
					class="hover:text-ink relative inline-flex items-center gap-1.5"
				>
					Karfa
					{#if cart.count > 0}
						<span
							class="bg-brand inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium text-white"
						>
							{cart.count}
						</span>
					{/if}
				</a>
			</nav>
		</div>
	</header>

	<!-- Main content. Drop flex-1 so the footer sits right below content
	     on short pages instead of being pushed to the bottom of a min-h
	     viewport. Small pb gives the popular peptides carousel some
	     breathing room before the footer rule. -->
	<main class={showNav ? 'pb-6' : ''}>
		{@render children()}
	</main>

	<footer class="border-outline border-t {showNav ? 'mb-20' : 'mt-12'}">
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

	{#if showNav}
		<!-- Bottom nav — fixed, safe-area aware. Six tabs balance shop +
		     reference + reminders into one tap layer. -->
		<nav
			class="fixed inset-x-0 bottom-0 z-40 border-outline border-t bg-white/95 backdrop-blur dark:bg-ink/95"
			style="padding-bottom: env(safe-area-inset-bottom);"
			aria-label="Primary"
		>
			<ul class="mx-auto grid max-w-md grid-cols-6">
				{#each tabs as tab (tab.href + tab.label)}
					{@const active = tab.match(relPath)}
					<li>
						<a
							href={tab.href}
							class="flex flex-col items-center gap-1 py-2 text-[10px] transition-colors"
							class:text-brand={active}
							class:font-medium={active}
							class:text-muted={!active}
							aria-current={active ? 'page' : undefined}
						>
							<span
								class="flex h-8 w-12 items-center justify-center rounded-full transition-colors"
								style={active
								? 'background-color: color-mix(in srgb, var(--color-brand) 15%, transparent);'
								: ''}
							>
								{#if tab.icon === 'shop'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
										<line x1="3" y1="6" x2="21" y2="6" />
										<path d="M16 10a4 4 0 0 1-8 0" />
									</svg>
								{:else if tab.icon === 'home'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" />
									</svg>
								{:else if tab.icon === 'stacks'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<path d="M12 20h9" />
										<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
									</svg>
								{:else if tab.icon === 'news'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<rect x="3" y="4" width="18" height="16" rx="2" />
										<line x1="3" y1="10" x2="21" y2="10" />
										<line x1="7" y1="14" x2="13" y2="14" />
									</svg>
								{:else if tab.icon === 'doses'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<rect x="6" y="3" width="12" height="18" rx="2" />
										<line x1="9" y1="11" x2="15" y2="11" />
										<line x1="12" y1="8" x2="12" y2="14" />
									</svg>
								{:else}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
										<circle cx="12" cy="12" r="3" />
										<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
									</svg>
								{/if}
							</span>
							<span>{tab.label}</span>
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	{/if}
</div>

<script lang="ts">
	import { listTenants } from '$lib/tenants';
	const tenants = listTenants();
</script>

<svelte:head>
	<title>Peptora Shop — platform</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-16">
	<p class="text-brand mb-2 text-xs font-medium uppercase tracking-wide">Platform</p>
	<h1 class="mb-4 text-4xl font-bold tracking-tight">Peptora Shop</h1>
	<p class="text-muted mb-8 text-lg">
		Multi-tenant storefront platform. Hver verslun fær <code class="font-mono">shop.peptora.app/&lt;slug&gt;</code>
		(eða eigin subdomain) með eigin vörum og greiðsluuppsetningu.
	</p>

	<a
		href="/sell"
		class="bg-brand hover:bg-brand-dark mb-12 inline-flex items-center rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors"
	>
		Sækja um eigin verslun →
	</a>

	<section>
		<h2 class="mb-4 text-xs font-medium uppercase tracking-wide text-muted">Active tenants</h2>
		{#if tenants.length === 0}
			<p class="text-muted italic">No tenants configured yet.</p>
		{:else}
			<ul class="space-y-3">
				{#each tenants as tenant (tenant.slug)}
					<li>
						<a
							href="/{tenant.slug}"
							class="border-outline hover:border-brand block rounded-2xl border p-5 transition-colors"
						>
							<div class="flex items-baseline justify-between gap-3">
								<h3 class="text-lg font-semibold">{tenant.name}</h3>
								<code class="text-muted font-mono text-xs">{tenant.slug}</code>
							</div>
							<p class="text-muted mt-1 text-sm">{tenant.tagline}</p>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<footer class="text-muted mt-16 text-xs">
		<p>
			This is the platform landing page. Real customers visit
			<code class="font-mono">&lt;slug&gt;.peptora.app</code> directly.
		</p>
	</footer>
</main>

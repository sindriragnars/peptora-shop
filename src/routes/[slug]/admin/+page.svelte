<script lang="ts">
	import { formatPriceISK } from '$lib/products';
	import type { OrderStatus } from '$lib/orders';

	let { data } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);

	const statusLabel: Record<OrderStatus, string> = {
		pending: 'Bíður greiðslu',
		paid: 'Greitt',
		fulfilled: 'Sent',
		failed: 'Mistókst',
		expired: 'Útrunnið',
		cancelled: 'Aflýst'
	};

	const statusColor: Record<OrderStatus, string> = {
		pending: 'bg-amber-100 text-amber-800',
		paid: 'bg-emerald-100 text-emerald-800',
		fulfilled: 'bg-gray-200 text-gray-700',
		failed: 'bg-red-100 text-red-800',
		expired: 'bg-gray-200 text-gray-700',
		cancelled: 'bg-gray-200 text-gray-700'
	};

	const stockLabel: Record<string, string> = {
		low: 'Fáir eftir',
		out: 'Uppselt'
	};
	const stockColor: Record<string, string> = {
		low: 'bg-amber-100 text-amber-800',
		out: 'bg-red-100 text-red-800'
	};

	function formatDate(ms: number): string {
		return new Date(ms).toLocaleString('is-IS', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Yfirlit · {tenant.name} admin</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-6 py-8">
	<h1 class="mb-6 text-2xl font-bold tracking-tight">Yfirlit</h1>

	<!-- Top KPI strip: revenue windows + a "needs attention" callout for
	     pending orders (the operator's primary call-to-action). -->
	<section class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="border-outline rounded-2xl border bg-white p-5">
			<div class="text-muted text-xs font-medium uppercase tracking-wide">Sala í dag</div>
			<div class="mt-1 font-mono text-2xl font-semibold">{formatPriceISK(data.revenue.today)}</div>
		</div>
		<div class="border-outline rounded-2xl border bg-white p-5">
			<div class="text-muted text-xs font-medium uppercase tracking-wide">Sala 7 dagar</div>
			<div class="mt-1 font-mono text-2xl font-semibold">{formatPriceISK(data.revenue.week)}</div>
		</div>
		<div class="border-outline rounded-2xl border bg-white p-5">
			<div class="text-muted text-xs font-medium uppercase tracking-wide">Sala 30 dagar</div>
			<div class="mt-1 font-mono text-2xl font-semibold">{formatPriceISK(data.revenue.month)}</div>
		</div>
		<a
			href="{pathPrefix}/admin/orders?status=pending"
			class="border-outline hover:border-brand rounded-2xl border bg-white p-5 transition-colors"
			class:bg-amber-50={data.counts.pending > 0}
		>
			<div class="text-muted text-xs font-medium uppercase tracking-wide">Bíða greiðslu</div>
			<div class="mt-1 text-2xl font-semibold">
				{data.counts.pending}
				{#if data.counts.pending > 0}
					<span class="text-muted ml-1 text-sm font-normal">þarf athygli</span>
				{/if}
			</div>
		</a>
	</section>

	<!-- Order status breakdown — quick scan of what state the queue is in. -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Pantanir eftir stöðu</h2>
		<div class="border-outline grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-cream-dark sm:grid-cols-5">
			{#each [
				{ key: 'all', label: 'Allar', count: data.counts.all, href: `${pathPrefix}/admin/orders` },
				{ key: 'paid', label: 'Greiddar', count: data.counts.paid, href: `${pathPrefix}/admin/orders?status=paid` },
				{ key: 'fulfilled', label: 'Sendar', count: data.counts.fulfilled, href: `${pathPrefix}/admin/orders?status=fulfilled` },
				{ key: 'cancelled', label: 'Aflýstar', count: data.counts.cancelled, href: `${pathPrefix}/admin/orders?status=cancelled` },
				{ key: 'failed', label: 'Mistókust', count: data.counts.failed, href: `${pathPrefix}/admin/orders?status=failed` }
			] as bucket (bucket.key)}
				<a href={bucket.href} class="bg-white p-4 hover:bg-cream-dark/40 transition-colors">
					<div class="text-muted text-xs">{bucket.label}</div>
					<div class="mt-0.5 text-xl font-semibold">{bucket.count}</div>
				</a>
			{/each}
		</div>
	</section>

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Recent orders, takes 2/3 of the row on desktop. -->
		<section class="lg:col-span-2">
			<div class="mb-3 flex items-baseline justify-between">
				<h2 class="text-muted text-xs font-medium uppercase tracking-wide">Nýjustu pantanir</h2>
				<a href="{pathPrefix}/admin/orders" class="text-muted hover:text-ink text-xs">Sjá allt →</a>
			</div>
			{#if data.recentOrders.length === 0}
				<div class="border-outline rounded-2xl border bg-white p-8 text-center">
					<p class="text-muted text-sm">Engar pantanir komnar inn enn.</p>
				</div>
			{:else}
				<div class="border-outline overflow-hidden rounded-2xl border bg-white">
					<table class="w-full text-sm">
						<thead class="bg-cream-dark/40">
							<tr>
								<th class="text-muted px-4 py-3 text-left font-medium">Dagsetning</th>
								<th class="text-muted px-4 py-3 text-left font-medium">Viðskiptavinur</th>
								<th class="text-muted px-4 py-3 text-left font-medium">Staða</th>
								<th class="text-muted px-4 py-3 text-right font-medium">Upphæð</th>
							</tr>
						</thead>
						<tbody>
							{#each data.recentOrders as o (o.id)}
								<tr class="border-outline border-t">
									<td class="px-4 py-3">
										<a href="{pathPrefix}/admin/orders/{o.id}" class="hover:text-brand font-mono text-xs">
											{formatDate(o.createdAt)}
										</a>
									</td>
									<td class="px-4 py-3">
										<div class="font-medium">{o.customerName}</div>
										<div class="text-muted text-xs">{o.itemCount} vörur</div>
									</td>
									<td class="px-4 py-3">
										<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {statusColor[o.status]}">
											{statusLabel[o.status]}
										</span>
									</td>
									<td class="px-4 py-3 text-right font-mono">{formatPriceISK(o.totalISK)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<!-- Right sidebar: catalog summary + low-stock callouts. -->
		<section>
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Vörur</h2>
			<div class="border-outline mb-4 rounded-2xl border bg-white p-5">
				<div class="text-3xl font-semibold">{data.productCount}</div>
				<div class="text-muted text-sm">skráðar vörur</div>
				<div class="mt-4 flex gap-2">
					<a
						href="{pathPrefix}/admin/products"
						class="border-outline hover:border-brand inline-flex flex-1 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
					>
						Sjá lista
					</a>
					<a
						href="{pathPrefix}/admin/products/new"
						class="bg-brand hover:bg-brand-dark inline-flex flex-1 items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium text-white transition-colors"
					>
						+ Ný vara
					</a>
				</div>
			</div>

			{#if data.lowStock.length > 0}
				<div class="border-outline rounded-2xl border bg-white p-5">
					<div class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">
						Lager-viðvörun
					</div>
					<ul class="space-y-2">
						{#each data.lowStock as item (item.id)}
							<li class="flex items-center justify-between gap-3">
								<a href="{pathPrefix}/admin/products/{item.id}" class="hover:text-brand truncate text-sm">
									{item.title}
								</a>
								<span class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {stockColor[item.stock] ?? ''}">
									{stockLabel[item.stock] ?? item.stock}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</section>
	</div>
</main>

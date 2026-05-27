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

	const filters = [
		{ key: '', label: 'Allar' },
		{ key: 'paid', label: 'Greiddar' },
		{ key: 'fulfilled', label: 'Sendar' },
		{ key: 'pending', label: 'Bíður greiðslu' },
		{ key: 'cancelled', label: 'Aflýstar' }
	] as const;

	function formatDate(ms: number): string {
		return new Date(ms).toLocaleString('is-IS', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Pantanir · {tenant.name} admin</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="mx-auto max-w-6xl px-6 py-8">
	<div class="mb-6 flex items-baseline justify-between">
		<h1 class="text-2xl font-bold tracking-tight">Pantanir</h1>
	</div>

	<!-- Status filter tabs -->
	<nav class="text-muted mb-6 flex flex-wrap gap-2 text-sm">
		{#each filters as f (f.key)}
			{@const count = f.key === '' ? data.counts.all : (data.counts[f.key as keyof typeof data.counts] ?? 0)}
			<a
				href={f.key ? `?status=${f.key}` : '?'}
				class="border-outline inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors"
				class:border-brand={data.filter === f.key || (data.filter === null && f.key === '')}
				class:text-ink={data.filter === f.key || (data.filter === null && f.key === '')}
			>
				{f.label}
				<span class="text-muted text-xs">{count}</span>
			</a>
		{/each}
	</nav>

	{#if data.orders.length === 0}
		<section class="border-outline rounded-2xl border p-12 text-center">
			<p class="text-muted">Engar pantanir í þessum flokki.</p>
		</section>
	{:else}
		<div class="overflow-hidden rounded-2xl border border-outline bg-white">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-outline border-b text-left text-xs uppercase tracking-wide text-muted">
						<th class="px-4 py-3 font-medium">Pöntun</th>
						<th class="px-4 py-3 font-medium">Viðskiptavinur</th>
						<th class="px-4 py-3 font-medium">Tíma</th>
						<th class="px-4 py-3 font-medium">Staða</th>
						<th class="px-4 py-3 text-right font-medium">Upphæð</th>
					</tr>
				</thead>
				<tbody>
					{#each data.orders as order (order.id)}
						<tr class="border-outline border-b last:border-0 hover:bg-cream-dark/30">
							<td class="px-4 py-3">
								<a
									href="{pathPrefix}/admin/orders/{order.id}"
									class="font-mono text-xs hover:underline"
								>
									{order.id.slice(0, 8)}
								</a>
								<p class="text-muted mt-0.5 text-xs">
									{order.items.length} {order.items.length === 1 ? 'vara' : 'vörur'}
								</p>
							</td>
							<td class="px-4 py-3">
								<p>{order.customer.name}</p>
								<p class="text-muted text-xs">{order.customer.email}</p>
							</td>
							<td class="text-muted px-4 py-3 text-xs">{formatDate(order.createdAt)}</td>
							<td class="px-4 py-3">
								<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusColor[order.status]}">
									{statusLabel[order.status]}
								</span>
							</td>
							<td class="px-4 py-3 text-right font-mono font-medium">
								{formatPriceISK(order.totalISK)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>

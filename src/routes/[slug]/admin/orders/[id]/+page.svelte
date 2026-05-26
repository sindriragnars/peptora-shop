<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatPriceISK } from '$lib/products';
	import type { OrderStatus } from '$lib/orders';

	let { data, form } = $props();
	const tenant = $derived(data.tenant);
	const order = $derived(data.order);

	const statusLabel: Record<OrderStatus, string> = {
		pending: 'Bíður greiðslu',
		paid: 'Greitt — bíður sendingar',
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

	function formatDate(ms: number): string {
		return new Date(ms).toLocaleString('is-IS', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let fulfilling = $state(false);
</script>

<svelte:head>
	<title>Pöntun #{order.id.slice(0, 8)} · {tenant.name} admin</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="mx-auto max-w-4xl px-6 py-8">
	<nav class="mb-6 text-sm">
		<a href="/{tenant.slug}/admin/orders" class="text-muted hover:text-ink">← Allar pantanir</a>
	</nav>

	<div class="mb-6 flex items-baseline justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Pöntun #{order.id.slice(0, 8)}</h1>
			<p class="text-muted mt-1 text-sm">{formatDate(order.createdAt)}</p>
		</div>
		<span class="rounded-full px-3 py-1 text-xs font-medium {statusColor[order.status]}">
			{statusLabel[order.status]}
		</span>
	</div>

	{#if form?.success}
		<div class="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			Merkt sem sent ✓
		</div>
	{:else if form?.error}
		<div class="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{form.error}</div>
	{/if}

	{#if order.status === 'paid'}
		<form
			method="POST"
			action="?/fulfill"
			use:enhance={() => {
				fulfilling = true;
				return async ({ update }) => {
					await update();
					fulfilling = false;
				};
			}}
			class="mb-8"
		>
			<button
				type="submit"
				disabled={fulfilling}
				class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
			>
				{fulfilling ? 'Merki…' : 'Merkja sem sent'}
			</button>
		</form>
	{/if}

	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<!-- Items -->
		<div class="md:col-span-2">
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Vörur</h2>
			<div class="border-outline overflow-hidden rounded-2xl border bg-white">
				<table class="w-full text-sm">
					<tbody>
						{#each order.items as item (item.productId)}
							<tr class="border-outline border-b last:border-0">
								<td class="px-4 py-3">
									<p class="font-medium">{item.title}</p>
									<p class="text-muted font-mono text-xs">
										{item.productId}
									</p>
								</td>
								<td class="px-4 py-3 text-right text-sm">
									<p class="font-mono">{formatPriceISK(item.priceISK)} × {item.qty}</p>
									<p class="text-muted font-mono text-xs">
										= {formatPriceISK(item.lineTotalISK)}
									</p>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot class="border-outline border-t bg-cream-dark/30">
						<tr>
							<td class="text-muted px-4 py-2 text-xs">Vörur</td>
							<td class="px-4 py-2 text-right font-mono text-sm">{formatPriceISK(order.subtotalISK)}</td>
						</tr>
						<tr>
							<td class="text-muted px-4 py-2 text-xs">Sending ({order.shipping.option})</td>
							<td class="px-4 py-2 text-right font-mono text-sm">{formatPriceISK(order.shipping.costISK)}</td>
						</tr>
						<tr class="border-outline border-t font-semibold">
							<td class="px-4 py-3">Samtals</td>
							<td class="px-4 py-3 text-right font-mono">{formatPriceISK(order.totalISK)}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>

		<!-- Customer + meta sidebar -->
		<aside class="md:col-span-1 space-y-6">
			<section>
				<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Viðskiptavinur</h2>
				<div class="border-outline rounded-2xl border bg-white p-4 text-sm">
					<p class="font-medium">{order.customer.name}</p>
					<p class="mt-1">
						<a href="mailto:{order.customer.email}" class="text-brand hover:underline">{order.customer.email}</a>
					</p>
					<p>{order.customer.phone}</p>
				</div>
			</section>

			<section>
				<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Sendingarheimilisfang</h2>
				<div class="border-outline rounded-2xl border bg-white p-4 text-sm leading-relaxed">
					<p>{order.customer.address}</p>
					<p>{order.customer.postalCode} {order.customer.city}</p>
				</div>
			</section>

			{#if order.customer.notes}
				<section>
					<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Athugasemd</h2>
					<div class="border-outline rounded-2xl border bg-white p-4 text-sm whitespace-pre-wrap">
						{order.customer.notes}
					</div>
				</section>
			{/if}

			<section>
				<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">Greiðsla</h2>
				<dl class="border-outline space-y-2 rounded-2xl border bg-white p-4 text-xs">
					<div class="flex justify-between">
						<dt class="text-muted">Revolut order</dt>
						<dd class="font-mono">{order.revolut.orderId.slice(0, 12)}…</dd>
					</div>
					{#if order.paidAt}
						<div class="flex justify-between">
							<dt class="text-muted">Greitt</dt>
							<dd>{formatDate(order.paidAt)}</dd>
						</div>
					{/if}
				</dl>
			</section>
		</aside>
	</div>
</main>

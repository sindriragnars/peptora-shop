<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SignupApplication, SignupStatus } from '$lib/signups';

	let { data, form } = $props();

	const statusLabel: Record<SignupStatus, string> = {
		pending: 'Bíður',
		approved: 'Samþykkt',
		rejected: 'Hafnað'
	};

	const statusColor: Record<SignupStatus, string> = {
		pending: 'bg-amber-100 text-amber-800',
		approved: 'bg-emerald-100 text-emerald-800',
		rejected: 'bg-gray-200 text-gray-700'
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

	let busy = $state<string | null>(null);
</script>

<svelte:head>
	<title>Umsóknir · Peptora Shop admin</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="mx-auto max-w-5xl px-6 py-8">
	<div class="mb-6">
		<p class="text-muted text-xs font-medium uppercase tracking-wide">Platform admin</p>
		<h1 class="text-2xl font-bold tracking-tight">Umsóknir um verslun</h1>
	</div>

	{#if form?.ok && form.action === 'approved'}
		<div class="mb-6 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
			Umsókn samþykkt ✓ — næsta skref: keyrðu git-workflow fyrir tenant create handvirkt.
		</div>
	{:else if form?.ok && form.action === 'rejected'}
		<div class="mb-6 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-700">Umsókn hafnað.</div>
	{/if}

	<!-- Pending queue -->
	<section class="mb-12">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">
			Bíða úrlausnar ({data.pending.length})
		</h2>
		{#if data.pending.length === 0}
			<div class="border-outline rounded-2xl border p-8 text-center">
				<p class="text-muted">Engar umsóknir bíða.</p>
			</div>
		{:else}
			<div class="space-y-4">
				{#each data.pending as app (app.id)}
					{@render row(app)}
				{/each}
			</div>
		{/if}
	</section>

	<!-- Processed -->
	{#if data.processed.length > 0}
		<section>
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">
				Afgreitt ({data.processed.length})
			</h2>
			<div class="space-y-2">
				{#each data.processed as app (app.id)}
					<div class="border-outline flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm">
						<div>
							<span class="font-medium">{app.name}</span>
							<span class="text-muted ml-2 font-mono text-xs">{app.slug}</span>
							<span class="text-muted ml-2 text-xs">{app.email}</span>
						</div>
						<div class="flex items-center gap-3">
							<span class="text-muted text-xs">{app.processedAt ? formatDate(app.processedAt) : ''}</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusColor[app.status]}">
								{statusLabel[app.status]}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</main>

{#snippet row(app: SignupApplication)}
	<article class="border-outline rounded-2xl border bg-white p-5">
		<div class="mb-3 flex items-baseline justify-between">
			<div>
				<h3 class="text-lg font-semibold">{app.name}</h3>
				<p class="text-muted text-xs">
					<code class="font-mono">shop.peptora.app/{app.slug}</code> · sótti um {formatDate(app.createdAt)}
				</p>
			</div>
			<span class="rounded-full px-2.5 py-1 text-xs font-medium {statusColor[app.status]}">
				{statusLabel[app.status]}
			</span>
		</div>

		<dl class="text-muted mb-4 grid grid-cols-1 gap-x-6 gap-y-1 text-sm md:grid-cols-2">
			<div class="flex gap-2"><dt class="w-20 shrink-0">Eigandi</dt><dd class="text-ink">{app.ownerName}</dd></div>
			<div class="flex gap-2"><dt class="w-20 shrink-0">Netfang</dt><dd class="text-ink"><a class="hover:underline" href="mailto:{app.email}">{app.email}</a></dd></div>
			{#if app.phone}
				<div class="flex gap-2"><dt class="w-20 shrink-0">Sími</dt><dd class="text-ink">{app.phone}</dd></div>
			{/if}
			{#if app.address}
				<div class="flex gap-2"><dt class="w-20 shrink-0">Address</dt><dd class="text-ink">{app.address}</dd></div>
			{/if}
			<div class="flex gap-2"><dt class="w-20 shrink-0">Brand</dt>
				<dd class="text-ink flex items-center gap-2">
					<span class="inline-block h-3 w-3 rounded-sm" style="background:{app.brandColor}"></span>
					<code class="font-mono text-xs">{app.brandColor}</code>
				</dd>
			</div>
			<div class="flex gap-2"><dt class="w-20 shrink-0">Sending</dt><dd class="text-ink font-mono text-xs">{app.flatRateISK.toLocaleString('is-IS')} kr. (frítt yfir {app.freeShippingISK.toLocaleString('is-IS')})</dd></div>
		</dl>

		<p class="bg-cream-dark/30 mb-4 whitespace-pre-wrap rounded-lg p-3 text-sm leading-relaxed">{app.description}</p>

		<div class="flex flex-wrap gap-2">
			<form
				method="POST"
				action="?/approve"
				use:enhance={() => {
					busy = app.id;
					return async ({ update }) => {
						await update();
						busy = null;
					};
				}}
			>
				<input type="hidden" name="id" value={app.id} />
				<button
					type="submit"
					disabled={busy === app.id}
					class="bg-brand hover:bg-brand-dark rounded-full px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
				>
					{busy === app.id ? 'Sendi…' : 'Samþykkja'}
				</button>
			</form>
			<form
				method="POST"
				action="?/reject"
				use:enhance={() => {
					busy = app.id;
					return async ({ update }) => {
						await update();
						busy = null;
					};
				}}
				class="flex items-center gap-2"
			>
				<input type="hidden" name="id" value={app.id} />
				<input
					type="text"
					name="reason"
					placeholder="Ástæða (valfrjáls)"
					class="border-outline focus:border-brand w-48 rounded-full border px-3 py-1.5 text-xs focus:outline-none"
				/>
				<button
					type="submit"
					disabled={busy === app.id}
					class="border-outline hover:bg-gray-100 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
				>
					Hafna
				</button>
			</form>
		</div>
	</article>
{/snippet}

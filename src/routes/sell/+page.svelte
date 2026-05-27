<script lang="ts">
	import { enhance } from '$app/forms';
	let { form } = $props();

	let submitting = $state(false);
	let brandColor = $state(form?.values?.brandColor ?? '#0e7c66');
</script>

<svelte:head>
	<title>Sækja um verslun · Peptora Shop</title>
	<meta name="description" content="Sæktu um þína eigin verslun á Peptora Shop." />
</svelte:head>

<main class="mx-auto max-w-2xl px-6 py-12">
	<a href="/" class="text-muted hover:text-ink mb-6 inline-block text-sm">← Aftur í Peptora Shop</a>

	{#if form?.success}
		<section class="border-outline rounded-2xl border bg-white p-8">
			<h1 class="text-brand mb-3 text-2xl font-bold tracking-tight">Umsókn móttekin ✓</h1>
			<p class="text-muted mb-2">
				Þú baðst um verslun við <code class="bg-cream-dark rounded px-1 py-0.5 font-mono">{form.slug}</code>.
			</p>
			<p class="text-muted">
				Við förum yfir umsóknina þína innan dags og sendum þér tölvupóst um leið og verslunin er virk.
			</p>
		</section>
	{:else}
		<h1 class="mb-3 text-3xl font-bold tracking-tight">Sækja um verslun</h1>
		<p class="text-muted mb-8">
			Fylltu út formið og við förum yfir umsóknina innan dags. Þú þarft engan eigin domain — gmail
			eða sambærilegt er nóg.
		</p>

		<form
			method="POST"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
			class="space-y-5"
		>
			<!-- Slug -->
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Slug (URL)</span>
				<div class="border-outline focus-within:border-brand flex overflow-hidden rounded-lg border bg-white">
					<span class="bg-cream-dark/40 text-muted px-3 py-2.5 font-mono text-sm">shop.peptora.app/</span>
					<input
						type="text"
						name="slug"
						required
						pattern="[a-z][a-z0-9-]{'{1,29}'}"
						value={form?.values?.slug ?? ''}
						placeholder="palli"
						class="flex-1 px-2 py-2.5 font-mono text-sm focus:outline-none"
					/>
				</div>
				<p class="text-muted mt-1 text-xs">
					Lowercase + tölur + bandstrik. T.d. "palli" eða "natural-shop".
				</p>
				{#if form?.errors?.slug}<p class="mt-1 text-xs text-red-700">{form.errors.slug}</p>{/if}
			</label>

			<!-- Shop name -->
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Heiti verslunar</span>
				<input
					type="text"
					name="name"
					required
					value={form?.values?.name ?? ''}
					placeholder="Palli's Heilsa"
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
				/>
				{#if form?.errors?.name}<p class="mt-1 text-xs text-red-700">{form.errors.name}</p>{/if}
			</label>

			<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
				<!-- Owner name -->
				<label class="block">
					<span class="mb-1 block text-sm font-medium">Þitt nafn</span>
					<input
						type="text"
						name="ownerName"
						required
						autocomplete="name"
						value={form?.values?.ownerName ?? ''}
						class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
					/>
					{#if form?.errors?.ownerName}<p class="mt-1 text-xs text-red-700">{form.errors.ownerName}</p>{/if}
				</label>

				<!-- Email -->
				<label class="block">
					<span class="mb-1 block text-sm font-medium">Netfang</span>
					<input
						type="email"
						name="email"
						required
						autocomplete="email"
						value={form?.values?.email ?? ''}
						placeholder="palli@gmail.com"
						class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
					/>
					{#if form?.errors?.email}<p class="mt-1 text-xs text-red-700">{form.errors.email}</p>{/if}
				</label>

				<!-- Phone -->
				<label class="block">
					<span class="mb-1 block text-sm font-medium">Sími <span class="text-muted text-xs">(valfrjálst)</span></span>
					<input
						type="tel"
						name="phone"
						autocomplete="tel"
						value={form?.values?.phone ?? ''}
						placeholder="+354 555 1234"
						class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
					/>
				</label>

				<!-- Brand color -->
				<label class="block">
					<span class="mb-1 block text-sm font-medium">Brand litur</span>
					<div class="border-outline focus-within:border-brand flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5">
						<input
							type="color"
							bind:value={brandColor}
							class="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
							aria-label="Velja lit"
						/>
						<input
							type="text"
							name="brandColor"
							required
							pattern="#[0-9a-fA-F]{'{6}'}"
							bind:value={brandColor}
							class="flex-1 font-mono text-sm focus:outline-none"
						/>
					</div>
					{#if form?.errors?.brandColor}<p class="mt-1 text-xs text-red-700">{form.errors.brandColor}</p>{/if}
				</label>
			</div>

			<!-- Address -->
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Heimilisfang <span class="text-muted text-xs">(valfrjálst, fyrir fótinn)</span></span>
				<input
					type="text"
					name="address"
					value={form?.values?.address ?? ''}
					autocomplete="street-address"
					placeholder="Suðurlandsbraut 4, 108 Reykjavík"
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
				/>
			</label>

			<!-- Shipping -->
			<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
				<label class="block">
					<span class="mb-1 block text-sm font-medium">Sendingargjald (ISK)</span>
					<input
						type="number"
						name="flatRateISK"
						required
						min="0"
						max="100000"
						step="10"
						value={form?.values?.flatRateISK ?? '990'}
						class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono focus:outline-none"
					/>
					{#if form?.errors?.flatRateISK}<p class="mt-1 text-xs text-red-700">{form.errors.flatRateISK}</p>{/if}
				</label>
				<label class="block">
					<span class="mb-1 block text-sm font-medium">Frítt yfir (ISK)</span>
					<input
						type="number"
						name="freeShippingISK"
						required
						min="0"
						max="1000000"
						step="500"
						value={form?.values?.freeShippingISK ?? '15000'}
						class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono focus:outline-none"
					/>
					{#if form?.errors?.freeShippingISK}<p class="mt-1 text-xs text-red-700">{form.errors.freeShippingISK}</p>{/if}
				</label>
			</div>

			<!-- Description -->
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Hvað ætlar þú að selja?</span>
				<textarea
					name="description"
					required
					rows="4"
					minlength="10"
					maxlength="1000"
					value={form?.values?.description ?? ''}
					placeholder="Stutt lýsing — vörur, markaður, hvers vegna þú vilt selja..."
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 text-sm focus:outline-none"
				></textarea>
				{#if form?.errors?.description}<p class="mt-1 text-xs text-red-700">{form.errors.description}</p>{/if}
			</label>

			<button
				type="submit"
				disabled={submitting}
				class="bg-brand hover:bg-brand-dark inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-base font-medium text-white transition-colors disabled:opacity-50"
			>
				{submitting ? 'Sendi umsókn…' : 'Senda umsókn'}
			</button>

			<p class="text-muted text-center text-xs">
				Við förum handvirkt yfir hverja umsókn áður en verslun er opnuð, til að koma í veg fyrir spam.
			</p>
		</form>
	{/if}
</main>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let { data, form } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	// Form snapshot the page started with. After a failed save the
	// `form` prop carries the user's most recent values; merge those
	// over the loaded baseline so retries don't lose input.
	const baseline = $derived(form?.values ?? data.form);
	const errors = $derived(form?.errors ?? {});

	let title = $state(baseline.title);
	let description = $state(baseline.description);
	let slug = $state(baseline.id);
	let priceISK = $state(baseline.price_isk);
	let stock = $state(baseline.stock);
	let category = $state(baseline.category);
	let featured = $state(baseline.featured);
	let order = $state(baseline.order);
	let weightGrams = $state(baseline.weight_grams ?? '');
	let sku = $state(baseline.sku);
	let images = $state<string[]>([...baseline.images]);
	let body = $state(baseline.body);

	let saving = $state(false);
	let deleting = $state(false);
	let uploading = $state(false);
	let uploadError = $state('');

	async function uploadImage(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		uploadError = '';
		try {
			const fd = new FormData();
			fd.append('image', file);
			const res = await fetch(`${pathPrefix}/admin/images`, { method: 'POST', body: fd });
			if (!res.ok) throw new Error(await res.text());
			const { url } = (await res.json()) as { url: string };
			images = [...images, url];
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Upload failed';
		} finally {
			uploading = false;
			input.value = '';
		}
	}

	function removeImage(idx: number) {
		images = images.filter((_, i) => i !== idx);
	}

	function autoSlug() {
		// If user hasn't set the slug yet and is in create mode, derive a
		// reasonable default from the title (Icelandic chars folded).
		if (!data.isNew || slug) return;
		const folded = title
			.toLowerCase()
			.replace(/[áàâ]/g, 'a')
			.replace(/[éèê]/g, 'e')
			.replace(/[íìî]/g, 'i')
			.replace(/[óòô]/g, 'o')
			.replace(/[úùû]/g, 'u')
			.replace(/[ý]/g, 'y')
			.replace(/[ð]/g, 'd')
			.replace(/[þ]/g, 'th')
			.replace(/[æ]/g, 'ae')
			.replace(/[ö]/g, 'o')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60);
		slug = folded;
	}
</script>

<svelte:head>
	<title>{data.isNew ? 'Ný vara' : title || 'Vara'} · {tenant.name} admin</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<nav class="mb-6 text-sm">
		<a href="{pathPrefix}/admin/products" class="text-muted hover:text-ink">← Allar vörur</a>
	</nav>

	<h1 class="mb-6 text-2xl font-bold tracking-tight">
		{data.isNew ? 'Ný vara' : 'Breyta vöru'}
	</h1>

	{#if errors._form}
		<div class="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errors._form}</div>
	{/if}

	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update();
				saving = false;
			};
		}}
		class="space-y-5"
	>
		<input type="hidden" name="sha" value={data.form.sha ?? ''} />

		<!-- Title + slug -->
		<label class="block">
			<span class="mb-1 block text-sm font-medium">Heiti vöru</span>
			<input
				type="text"
				name="title"
				bind:value={title}
				onblur={autoSlug}
				required
				class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
			/>
			{#if errors.title}<p class="mt-1 text-xs text-red-700">{errors.title}</p>{/if}
		</label>

		<label class="block">
			<span class="mb-1 block text-sm font-medium">Slug (URL)</span>
			<div class="border-outline focus-within:border-brand flex overflow-hidden rounded-lg border bg-white">
				<span class="bg-cream-dark/40 text-muted px-3 py-2.5 font-mono text-xs">/products/</span>
				<input
					type="text"
					name="id"
					bind:value={slug}
					required
					pattern="[a-z0-9][a-z0-9-]{'{0,59}'}"
					readonly={!data.isNew && slug === data.form.id}
					class="flex-1 px-2 py-2.5 font-mono text-sm focus:outline-none {!data.isNew && slug === data.form.id ? 'bg-gray-50' : ''}"
				/>
			</div>
			<p class="text-muted mt-1 text-xs">
				Lowercase, tölur, bandstrik. Ekki breyta nema þú vitir hvað þú ert að gera (URL breytist).
			</p>
			{#if errors.id}<p class="mt-1 text-xs text-red-700">{errors.id}</p>{/if}
		</label>

		<!-- Description -->
		<label class="block">
			<span class="mb-1 block text-sm font-medium">Lýsing (stutt)</span>
			<input
				type="text"
				name="description"
				bind:value={description}
				required
				class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
			/>
			<p class="text-muted mt-1 text-xs">1–2 línur. Sést á forsíðu og í SEO meta.</p>
			{#if errors.description}<p class="mt-1 text-xs text-red-700">{errors.description}</p>{/if}
		</label>

		<!-- Price, stock, category -->
		<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Verð (ISK)</span>
				<input
					type="number"
					name="price_isk"
					bind:value={priceISK}
					required
					min="0"
					step="100"
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono focus:outline-none"
				/>
				{#if errors.price_isk}<p class="mt-1 text-xs text-red-700">{errors.price_isk}</p>{/if}
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Birgðastaða</span>
				<select
					name="stock"
					bind:value={stock}
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
				>
					<option value="in-stock">Á lager</option>
					<option value="low">Fáir eftir</option>
					<option value="out">Uppselt</option>
				</select>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Flokkur</span>
				<select
					name="category"
					bind:value={category}
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
				>
					<option value="peptides">Peptíð</option>
					<option value="stack">Stack</option>
					<option value="supplies">Aukabúnaður</option>
					<option value="general">Almennt</option>
				</select>
			</label>
		</div>

		<!-- Order / SKU / Weight -->
		<div class="grid grid-cols-1 gap-5 md:grid-cols-3">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Birtingarröð</span>
				<input
					type="number"
					name="order"
					bind:value={order}
					min="0"
					max="9999"
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono focus:outline-none"
				/>
				<p class="text-muted mt-1 text-xs">Lægri = framar.</p>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium">SKU</span>
				<input
					type="text"
					name="sku"
					bind:value={sku}
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm focus:outline-none"
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Þyngd (g)</span>
				<input
					type="number"
					name="weight_grams"
					bind:value={weightGrams}
					min="0"
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono focus:outline-none"
				/>
			</label>
		</div>

		<label class="flex items-center gap-2">
			<input
				type="checkbox"
				name="featured"
				bind:checked={featured}
				class="h-4 w-4"
			/>
			<span class="text-sm">Sýna á forsíðu (Featured)</span>
		</label>

		<!-- Images -->
		<div class="block">
			<span class="mb-1 block text-sm font-medium">Myndir</span>
			<p class="text-muted mb-2 text-xs">Kvaðratísk mynd ~1200×1200 px, undir 500 KB. Krópast 1:1.</p>
			{#if images.length > 0}
				<div class="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
					{#each images as img, i (i)}
						<div class="border-outline relative aspect-square overflow-hidden rounded-lg border bg-white">
							<img src={img} alt="" class="h-full w-full object-cover" />
							<button
								type="button"
								onclick={() => removeImage(i)}
								class="absolute right-1 top-1 rounded-full bg-white/90 px-2 py-0.5 text-xs text-red-700 hover:bg-white"
								aria-label="Fjarlægja mynd"
							>
								×
							</button>
						</div>
					{/each}
				</div>
			{/if}
			<label class="border-outline hover:border-brand inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm">
				{uploading ? 'Hleður…' : '+ Hlaða upp mynd'}
				<input type="file" accept="image/*" onchange={uploadImage} class="sr-only" disabled={uploading} />
			</label>
			{#if uploadError}<p class="mt-1 text-xs text-red-700">{uploadError}</p>{/if}
			<input type="hidden" name="images" value={images.join('\n')} />
		</div>

		<!-- Body markdown -->
		<label class="block">
			<span class="mb-1 block text-sm font-medium">Ítarlýsing (Markdown)</span>
			<textarea
				name="body"
				bind:value={body}
				rows="14"
				class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm focus:outline-none"
			></textarea>
			<p class="text-muted mt-1 text-xs">
				## fyrir undirfyrirsögn, **feitletrun**, * fyrir lista, [tengill](url). Birtist neðst á vörusíðunni.
			</p>
		</label>

		<div class="flex items-center justify-between border-t pt-6">
			<button
				type="submit"
				disabled={saving || uploading}
				class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
			>
				{saving ? 'Vista…' : data.isNew ? 'Búa til vöru' : 'Vista breytingar'}
			</button>

			{#if !data.isNew}
				<button
					type="submit"
					formaction="?/delete"
					disabled={deleting}
					onclick={(e) => {
						if (!confirm('Eyða þessari vöru? Þetta er ekki afturkræft.')) e.preventDefault();
						else deleting = true;
					}}
					class="text-sm text-red-700 hover:underline disabled:opacity-50"
				>
					{deleting ? 'Eyði…' : 'Eyða vöru'}
				</button>
			{/if}
		</div>
	</form>
</main>

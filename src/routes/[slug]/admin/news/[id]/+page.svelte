<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	const tenant = $derived(data.tenant);
	const pathPrefix = $derived(data.pathPrefix);
	const baseline = $derived(form?.values ?? data.form);
	const errors = $derived(form?.errors ?? {});

	let title = $state(baseline.title);
	let slug = $state(baseline.id);
	let date = $state(baseline.date);
	let excerpt = $state(baseline.excerpt);
	let image = $state(baseline.image);
	let featured = $state(baseline.featured);
	let body = $state(baseline.body);

	// Local preview data URL — shows the uploaded file immediately, before
	// Vercel rebuilds with the new static asset (the committed /tenants/.../foo.png
	// path 404s for ~30 s after upload). After the next save+redirect, the page
	// reloads and `image` (the real static URL) takes over.
	let imagePreviewLocal = $state('');

	let saving = $state(false);
	let deleting = $state(false);
	let uploading = $state(false);
	let uploadError = $state('');

	// Track whether the user has manually edited the slug. While false in
	// create mode, the slug stays in sync with the title (folded Icelandic).
	// Flip true the moment they type into the slug field directly.
	let slugTouched = $state(!data.isNew);

	function foldToSlug(s: string): string {
		return s
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
			.slice(0, 80);
	}

	// Reactively derive slug from title until the user types into the slug
	// field. Pure-effect form so we don't fight the user's edits.
	$effect(() => {
		if (!slugTouched) {
			slug = foldToSlug(title);
		}
	});

	async function uploadImage(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploading = true;
		uploadError = '';

		// Read the file as a data URL up front so the preview shows
		// instantly — independent of the GitHub commit + Vercel redeploy
		// cycle that the public-path image relies on.
		try {
			imagePreviewLocal = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});
		} catch {
			// Preview is nice-to-have; failing it shouldn't block the upload.
		}

		try {
			const fd = new FormData();
			fd.append('image', file);
			const res = await fetch(`${pathPrefix}/admin/images`, { method: 'POST', body: fd });
			if (!res.ok) throw new Error(await res.text());
			const { url } = (await res.json()) as { url: string };
			image = url;
		} catch (e) {
			uploadError = e instanceof Error ? e.message : 'Upload failed';
			imagePreviewLocal = '';
		} finally {
			uploading = false;
			input.value = '';
		}
	}
</script>

<svelte:head>
	<title>{data.isNew ? 'Ný frétt' : title || 'Frétt'} · {tenant.name} admin</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<nav class="mb-6 text-sm">
		<a href="{pathPrefix}/admin/news" class="text-muted hover:text-ink">← Allar fréttir</a>
	</nav>

	<h1 class="mb-6 text-2xl font-bold tracking-tight">
		{data.isNew ? 'Ný frétt' : 'Breyta frétt'}
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

		<label class="block">
			<span class="mb-1 block text-sm font-medium">Fyrirsögn</span>
			<input
				type="text"
				name="title"
				bind:value={title}
				required
				class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
			/>
			{#if errors.title}<p class="mt-1 text-xs text-red-700">{errors.title}</p>{/if}
		</label>

		<label class="block">
			<span class="mb-1 block text-sm font-medium">Slug (URL)</span>
			<div class="border-outline focus-within:border-brand flex overflow-hidden rounded-lg border bg-white">
				<span class="bg-cream-dark/40 text-muted px-3 py-2.5 font-mono text-xs">/news/</span>
				<input
					type="text"
					name="id"
					bind:value={slug}
					oninput={() => (slugTouched = true)}
					required
					pattern="[a-z0-9][a-z0-9-]{'{0,79}'}"
					class="flex-1 px-2 py-2.5 font-mono text-sm focus:outline-none"
				/>
			</div>
			<p class="text-muted mt-1 text-xs">
				{data.isNew && !slugTouched
					? 'Búinn til sjálfvirkt úr fyrirsögn — má breyta.'
					: 'Lowercase, tölur, bandstrik.'}
			</p>
			{#if errors.id}<p class="mt-1 text-xs text-red-700">{errors.id}</p>{/if}
		</label>

		<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
			<label class="block">
				<span class="mb-1 block text-sm font-medium">Dagsetning</span>
				<input
					type="date"
					name="date"
					bind:value={date}
					required
					class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono focus:outline-none"
				/>
				{#if errors.date}<p class="mt-1 text-xs text-red-700">{errors.date}</p>{/if}
			</label>

			<label class="flex items-center gap-2 pt-7">
				<input
					type="checkbox"
					name="featured"
					bind:checked={featured}
					class="h-4 w-4"
				/>
				<span class="text-sm">Featured (sýna efst)</span>
			</label>
		</div>

		<label class="block">
			<span class="mb-1 block text-sm font-medium">Stutt lýsing (excerpt)</span>
			<textarea
				name="excerpt"
				bind:value={excerpt}
				rows="2"
				class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 focus:outline-none"
			></textarea>
			<p class="text-muted mt-1 text-xs">1–2 línur. Sést á listanum og sem SEO description.</p>
		</label>

		<!-- Cover image -->
		<div class="block">
			<span class="mb-1 block text-sm font-medium">Forsíðumynd (valfrjáls)</span>
			<p class="text-muted mb-2 text-xs">
				16:9 hlutfall — ideal 1600×900 px, JPG eða PNG, undir 500 KB. Krópast 16:9.
			</p>
			{#if imagePreviewLocal || image}
				<div class="border-outline relative mb-3 aspect-[16/9] overflow-hidden rounded-lg border bg-white">
					<img src={imagePreviewLocal || image} alt="" class="h-full w-full object-cover" />
					<button
						type="button"
						onclick={() => {
							image = '';
							imagePreviewLocal = '';
						}}
						class="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-xs text-red-700 hover:bg-white"
					>
						× Fjarlægja
					</button>
				</div>
				{#if imagePreviewLocal && image}
					<p class="text-muted -mt-2 mb-3 text-xs">
						Vistuð — birtist á /news eftir ~30 sek þegar vefurinn byggir upp aftur.
					</p>
				{/if}
			{/if}
			<label class="border-outline hover:border-brand inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm">
				{uploading ? 'Hleður…' : image || imagePreviewLocal ? 'Skipta út mynd' : '+ Hlaða upp mynd'}
				<input type="file" accept="image/*" onchange={uploadImage} class="sr-only" disabled={uploading} />
			</label>
			{#if uploadError}<p class="mt-1 text-xs text-red-700">{uploadError}</p>{/if}
			<input type="hidden" name="image" value={image} />
		</div>

		<label class="block">
			<span class="mb-1 block text-sm font-medium">Texti fréttar (Markdown)</span>
			<textarea
				name="body"
				bind:value={body}
				rows="18"
				class="border-outline focus:border-brand w-full rounded-lg border bg-white px-3 py-2.5 font-mono text-sm focus:outline-none"
			></textarea>
			<p class="text-muted mt-1 text-xs">
				## fyrir undirfyrirsögn, **feitletrun**, * fyrir lista, [tengill](url).
			</p>
		</label>

		<div class="flex items-center justify-between border-t pt-6">
			<button
				type="submit"
				disabled={saving || uploading}
				class="bg-brand hover:bg-brand-dark inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
			>
				{saving ? 'Vista…' : data.isNew ? 'Birta frétt' : 'Vista breytingar'}
			</button>

			{#if !data.isNew}
				<button
					type="submit"
					formaction="?/delete"
					disabled={deleting}
					onclick={(e) => {
						if (!confirm('Eyða þessari frétt? Þetta er ekki afturkræft.')) e.preventDefault();
						else deleting = true;
					}}
					class="text-sm text-red-700 hover:underline disabled:opacity-50"
				>
					{deleting ? 'Eyði…' : 'Eyða frétt'}
				</button>
			{/if}
		</div>
	</form>
</main>

<script lang="ts">
	import { goto } from '$app/navigation';
	import {
		getAllPeptidesAlphabetical,
		getInteractions,
		getPeptide,
		searchPeptides
	} from '$lib/peptides';
	import {
		makeStackId,
		relevantInteractions,
		saveCustomStack,
		type CustomStackPeptide
	} from '$lib/customStacks';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	const t = $derived(strings[prefs.lang]);
	const allPeptides = $derived(getAllPeptidesAlphabetical(prefs.lang));
	const interactions = $derived(getInteractions(prefs.lang));

	// Form state
	let name = $state('');
	let selected = $state<CustomStackPeptide[]>([]);
	let pickerOpen = $state(false);
	let pickerQuery = $state('');

	const selectedIds = $derived(selected.map((s) => s.id));
	const warnings = $derived(relevantInteractions(selectedIds, interactions));

	const pickerResults = $derived(
		pickerQuery.trim() ? searchPeptides(pickerQuery, prefs.lang) : allPeptides
	);

	function addPeptide(id: string) {
		if (selected.some((s) => s.id === id)) return;
		const p = getPeptide(id, prefs.lang);
		if (!p) return;
		// Default dose suggestion = the standard tier amount string.
		selected = [...selected, { id, dose: p.dosage.standard.amount }];
		pickerQuery = '';
		pickerOpen = false;
	}

	function removePeptide(id: string) {
		selected = selected.filter((s) => s.id !== id);
	}

	function updateDose(id: string, dose: string) {
		selected = selected.map((s) => (s.id === id ? { ...s, dose } : s));
	}

	const canSave = $derived(name.trim().length > 0 && selected.length > 0);

	function save() {
		if (!canSave) return;
		const stack = {
			id: makeStackId(),
			name: name.trim(),
			peptides: selected,
			createdAt: Date.now()
		};
		saveCustomStack(stack);
		goto('/stacks?tab=custom');
	}
</script>

<svelte:head>
	<title>New stack · Peptora</title>
</svelte:head>

<section class="mx-auto max-w-md p-5 pb-32">
	<a
		href="/stacks?tab=custom"
		class="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand"
	>
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
		>
			<line x1="19" y1="12" x2="5" y2="12" />
			<polyline points="12 19 5 12 12 5" />
		</svg>
		{t.builder_back}
	</a>

	<h1 class="mb-5 text-3xl font-bold tracking-tight">{t.builder_title}</h1>

	<!-- Name -->
	<label class="mb-5 block">
		<span class="text-muted mb-1 block text-xs font-medium uppercase tracking-wide">{t.builder_name_label}</span>
		<input
			type="text"
			bind:value={name}
			placeholder={t.builder_name_placeholder}
			class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-2xl border bg-transparent px-4 py-3 text-base outline-none"
		/>
	</label>

	<!-- Interaction warnings -->
	{#if warnings.length > 0}
		<aside
			class="mb-5 rounded-2xl border-l-4 border-red-500 bg-red-50 p-4 text-sm leading-relaxed dark:bg-red-950/30"
		>
			<p class="mb-2 font-semibold">⚠ {t.builder_warnings_title}</p>
			<ul class="space-y-2">
				{#each warnings as w (w.peptides.join('+'))}
					<li>
						<span class="mr-2 font-mono text-xs">
							{w.peptides.map((id) => getPeptide(id, prefs.lang)?.name ?? id).join(' + ')}
						</span>
						— {w.warning}
					</li>
				{/each}
			</ul>
		</aside>
	{/if}

	<!-- Selected peptides -->
	<section class="mb-5">
		<div class="mb-2 flex items-center justify-between">
			<span class="text-muted text-xs font-medium uppercase tracking-wide">{t.builder_peptides_label}</span>
			<span class="text-muted text-xs">{selected.length}</span>
		</div>

		{#if selected.length === 0}
			<p
				class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-6 text-center text-sm"
			>
				{t.builder_no_peptides_yet}
			</p>
		{:else}
			<ul class="space-y-2">
				{#each selected as item (item.id)}
					{@const p = getPeptide(item.id, prefs.lang)}
					<li
						class="border-outline dark:border-outline-dark rounded-2xl border p-3"
					>
						<div class="mb-2 flex items-center justify-between gap-2">
							<span class="font-semibold">{p?.name ?? item.id}</span>
							<button
								type="button"
								onclick={() => removePeptide(item.id)}
								class="text-muted hover:text-red-600"
								aria-label={t.builder_remove}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<line x1="18" y1="6" x2="6" y2="18" />
									<line x1="6" y1="6" x2="18" y2="18" />
								</svg>
							</button>
						</div>
						<input
							type="text"
							value={item.dose}
							oninput={(e) => updateDose(item.id, (e.currentTarget as HTMLInputElement).value)}
							placeholder={t.builder_dose_placeholder}
							aria-label={t.builder_dose_label}
							class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-xl border bg-transparent px-3 py-2 text-sm outline-none"
						/>
					</li>
				{/each}
			</ul>
		{/if}

		<button
			type="button"
			onclick={() => (pickerOpen = !pickerOpen)}
			class="border-outline dark:border-outline-dark hover:border-brand mt-3 flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium transition-colors"
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			{pickerOpen ? t.builder_picker_close : t.builder_add_peptide}
		</button>
	</section>

	<!-- Peptide picker — inline (not modal) for simplicity -->
	{#if pickerOpen}
		<section class="border-outline dark:border-outline-dark mb-5 rounded-2xl border p-4">
			<input
				type="search"
				bind:value={pickerQuery}
				placeholder={t.builder_picker_search}
				class="border-outline dark:border-outline-dark focus:border-brand mb-3 w-full rounded-full border bg-transparent px-4 py-2 text-sm outline-none"
			/>
			<ul class="max-h-72 space-y-1 overflow-y-auto">
				{#each pickerResults as p (p.id)}
					{@const already = selected.some((s) => s.id === p.id)}
					<li>
						<button
							type="button"
							disabled={already}
							onclick={() => addPeptide(p.id)}
							class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors enabled:hover:bg-cream-dark/60 enabled:dark:hover:bg-ink-soft/60 disabled:opacity-40"
						>
							<span>
								<span class="font-medium">{p.name}</span>
								<span class="text-muted ml-2 text-xs">{p.tagline}</span>
							</span>
							{#if already}
								<span class="text-brand text-xs">added</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</section>

<!-- Sticky save bar -->
<div
	class="border-outline dark:border-outline-dark bg-cream/95 dark:bg-ink/95 fixed inset-x-0 bottom-[68px] z-30 border-t backdrop-blur"
	style="padding-bottom: env(safe-area-inset-bottom);"
>
	<div class="mx-auto flex max-w-md gap-2 p-3">
		<button
			type="button"
			disabled={!canSave}
			onclick={save}
			class="bg-brand hover:bg-brand-dark flex-1 rounded-full py-2.5 text-center text-sm font-medium text-white transition-colors disabled:opacity-50"
		>
			{t.builder_save}
		</button>
	</div>
</div>

<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { getCategory, getPeptide, getInteractions } from '$lib/peptides';
	import {
		getCustomStack,
		deleteCustomStack,
		relevantInteractions,
		type CustomStack
	} from '$lib/customStacks';
	import { createRemindersFromStack } from '$lib/reminders';
	import { inferSchedule } from '$lib/scheduling';
	import StackTimeline from '$lib/StackTimeline.svelte';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';

	const s = $derived(strings[prefs.lang]);

	/* Detail view for a user-built stack. Mirrors the layout of
	   `/stacks/[id]` for suggested stacks so users feel they're in the
	   same surface — only the metadata blocks differ because custom
	   stacks don't carry goal / level / duration / protocol. */

	let stack = $state<CustomStack | null>(null);
	let notFound = $state(false);

	$effect(() => {
		const id = page.params.id;
		const s = getCustomStack(id);
		if (!s) {
			notFound = true;
			stack = null;
		} else {
			notFound = false;
			stack = s;
		}
	});

	// Hydrated peptide lookups for the chosen ids.
	const peptides = $derived(
		stack ? stack.peptides.map((p) => getPeptide(p.id, prefs.lang)).filter((p) => !!p) : []
	);
	// Same warning surface as suggested stacks — only flags interactions
	// where 2+ of the user's chosen peptides clash.
	const interactions = $derived(
		stack
			? relevantInteractions(stack.peptides.map((p) => p.id), getInteractions(prefs.lang))
			: []
	);

	// Custom stacks store the user's own dose text but no frequency, so
	// the timeline schedule + reminder times come from each peptide's
	// `standard` tier frequency. Good-enough default; the user can edit
	// any reminder afterwards.
	const timelineRows = $derived(
		stack
			? stack.peptides
					.map((item) => {
						const p = getPeptide(item.id, prefs.lang);
						if (!p) return null;
						const catId = p.categories[0];
						const c = catId ? getCategory(catId, prefs.lang) : undefined;
						return {
							name: p.name,
							color: c?.color ?? '#94A3B8',
							times: inferSchedule(p.dosage.standard.frequency).times
						};
					})
					.filter((r): r is { name: string; color: string; times: string[] } => r !== null)
			: []
	);

	let starting = $state(false);
	let startError = $state('');

	async function startStack() {
		if (!stack || starting) return;
		starting = true;
		startError = '';
		try {
			const items = stack.peptides
				.map((item) => {
					const p = getPeptide(item.id, prefs.lang);
					if (!p) return null;
					return {
						peptideId: item.id,
						dose: item.dose,
						frequency: p.dosage.standard.frequency
					};
				})
				.filter((x): x is { peptideId: string; dose: string; frequency: string } => x !== null);
			const count = await createRemindersFromStack(items);
			goto(`/doses?created=${count}`);
		} catch (e) {
			console.error(e);
			startError = s.stack_start_error;
			starting = false;
		}
	}

	function removeStack() {
		if (!stack) return;
		if (!confirm(s.stack_delete_confirm)) return;
		deleteCustomStack(stack.id);
		goto('/stacks?tab=custom');
	}
</script>

<svelte:head>
	<title>{stack?.name ?? 'Custom stack'} · Peptora</title>
</svelte:head>

<article class="mx-auto max-w-md p-5 pb-32">
	<a
		href="/stacks?tab=custom"
		class="text-muted hover:text-brand mb-4 inline-flex items-center gap-1 text-sm"
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
		{s.stack_back_all}
	</a>

	{#if notFound}
		<div
			class="border-outline dark:border-outline-dark text-muted rounded-2xl border border-dashed p-8 text-center text-sm"
		>
			{s.stack_not_found}
		</div>
	{:else if stack}
		<header class="mb-6 flex items-start justify-between gap-3">
			<div class="min-w-0 flex-1">
				<h1 class="text-3xl font-bold tracking-tight">{stack.name}</h1>
				<div class="mt-3 flex flex-wrap gap-2">
					<span
						class="bg-brand/10 text-brand rounded-full px-2.5 py-0.5 text-xs font-medium"
					>
						{s.stacks_custom_badge}
					</span>
				</div>
			</div>
			<button
				type="button"
				onclick={removeStack}
				aria-label={s.stack_delete_label}
				class="text-muted hover:text-red-600 -m-2 flex-shrink-0 p-2"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<polyline points="3 6 5 6 21 6" />
					<path
						d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
					/>
				</svg>
			</button>
		</header>

		{#if interactions.length > 0}
			<aside
				class="mb-6 rounded-2xl border-l-4 border-red-500 bg-red-50 p-4 text-sm leading-relaxed dark:bg-red-950/30"
			>
				<p class="mb-2 font-semibold">⚠ {s.stack_warnings_title}</p>
				<ul class="space-y-2">
					{#each interactions as w}
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

		{#if timelineRows.length > 0}
			<section class="mb-6">
				<StackTimeline rows={timelineRows} />
			</section>
		{/if}

		<section class="mb-6">
			<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
				{s.stack_section_peptides}
			</h2>
			<ul class="space-y-2">
				{#each stack.peptides as item (item.id)}
					{@const p = getPeptide(item.id, prefs.lang)}
					<li>
						<a
							href={`/peptides/${item.id}`}
							class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-4 transition-colors"
						>
							<div class="mb-0.5 flex items-center justify-between gap-2">
								<span class="font-semibold">{p?.name ?? item.id}</span>
								<span class="text-muted font-mono text-xs">{item.dose}</span>
							</div>
							{#if p?.tagline}
								<div class="text-muted line-clamp-2 text-xs">{p.tagline}</div>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>

		<aside
			class="mt-8 rounded-2xl border-l-4 border-amber-500 bg-amber-50 p-4 text-xs leading-relaxed dark:bg-amber-950/30"
		>
			<p class="mb-1 font-semibold">{s.stack_disclaimer_title}</p>
			<p>{s.stack_disclaimer_body}</p>
		</aside>
	{/if}
</article>

{#if stack && !notFound}
	<!-- Sticky CTA matches the suggested-stack detail page so the action
	     surface stays identical across tabs. -->
	<div
		class="border-outline dark:border-outline-dark bg-cream/95 dark:bg-ink/95 fixed inset-x-0 bottom-[68px] z-30 border-t backdrop-blur"
		style="padding-bottom: env(safe-area-inset-bottom);"
	>
		<div class="mx-auto max-w-md p-3">
			<button
				type="button"
				onclick={startStack}
				disabled={starting}
				class="bg-brand hover:bg-brand-dark w-full rounded-full py-2.5 text-sm font-medium text-white disabled:opacity-60"
			>
				{starting ? s.stack_start_pending : s.stack_start_action}
			</button>
			{#if startError}
				<p class="mt-2 text-center text-xs text-red-600 dark:text-red-400">{startError}</p>
			{/if}
		</div>
	</div>
{/if}

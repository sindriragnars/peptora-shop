<script lang="ts">
	import type { PageProps } from './$types';
	import { goto } from '$app/navigation';
	import { getCategory, getPeptide, getStack, getInteractions } from '$lib/peptides';
	import { prefs } from '$lib/prefs.svelte';
	import { strings } from '$lib/i18n';
	import { createRemindersFromStack } from '$lib/reminders';
	import { inferSchedule } from '$lib/scheduling';
	import StackTimeline from '$lib/StackTimeline.svelte';

	let { data }: PageProps = $props();

	const s = $derived(strings[prefs.lang]);

	// Re-derive from the locale data so flipping language swaps the
	// stack name, description and protocol text without a navigation.
	const stack = $derived(getStack(data.stack.id, prefs.lang) ?? data.stack);
	const peptides = $derived(
		stack.peptides
			.map((id) => getPeptide(id, prefs.lang))
			.filter((p): p is NonNullable<typeof p> => p !== undefined)
	);
	const interactions = $derived(
		getInteractions(prefs.lang).filter((w) => {
			const overlap = w.peptides.filter((id) => stack.peptides.includes(id));
			return overlap.length >= 2;
		})
	);

	const cat = $derived(getCategory(stack.goal, prefs.lang));
	const tint = $derived(cat?.color ?? '#94A3B8');

	// Goal label chip — reactive so it swaps language live.
	const goalLabel = $derived<Record<string, string>>({
		muscle: s.stack_goal_muscle,
		healing: s.stack_goal_healing,
		fat_loss: s.stack_goal_fat_loss,
		anti_aging: s.stack_goal_anti_aging,
		cognitive: s.stack_goal_cognitive,
		longevity: s.stack_goal_longevity
	});
	const levelLabel = $derived<Record<string, string>>({
		beginner: s.peptide_dose_tab_beginner,
		standard: s.peptide_dose_tab_standard,
		advanced: s.peptide_dose_tab_advanced
	});

	/** Dosage tier per peptide follows the user's chosen experience level,
	    falling back to `standard` if the tier is missing for some reason. */
	function tierFor(p: (typeof peptides)[number]) {
		return p.dosage[prefs.experience] ?? p.dosage.standard;
	}

	// Each row gets a tint colour from the peptide's primary category so
	// the timeline reads as a set of distinct compounds, not a wall of
	// same-coloured dots.
	const timelineRows = $derived(
		peptides.map((p) => {
			const catId = p.categories[0];
			const c = catId ? getCategory(catId, prefs.lang) : undefined;
			return {
				name: p.name,
				color: c?.color ?? '#94A3B8',
				times: inferSchedule(tierFor(p).frequency).times
			};
		})
	);

	let starting = $state(false);
	let startError = $state('');

	async function startStack() {
		if (starting) return;
		starting = true;
		startError = '';
		try {
			const items = peptides.map((p) => {
				const t = tierFor(p);
				return { peptideId: p.id, dose: t.amount, frequency: t.frequency };
			});
			const count = await createRemindersFromStack(items);
			goto(`/doses?created=${count}`);
		} catch (e) {
			console.error(e);
			startError = s.stack_start_error;
			starting = false;
		}
	}
</script>

<svelte:head>
	<title>{stack.name} · Peptora</title>
</svelte:head>

<article class="mx-auto max-w-md p-5 pb-32">
	<a href="/stacks" class="text-muted mb-4 inline-flex items-center gap-1 text-sm hover:text-brand">
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

	<header class="mb-6">
		<h1 class="text-3xl font-bold tracking-tight">{stack.name}</h1>
		<p class="text-muted mt-2 text-sm">{stack.description}</p>
		<div class="mt-3 flex flex-wrap gap-2">
			<span
				class="rounded-full px-2.5 py-0.5 text-xs font-medium"
				style={`background-color: ${tint}25; color: ${tint};`}
			>
				{goalLabel[stack.goal] ?? stack.goal}
			</span>
			<span
				class="border-outline dark:border-outline-dark rounded-full border px-2.5 py-0.5 text-xs font-medium"
			>
				{levelLabel[stack.experienceLevel] ?? stack.experienceLevel}
			</span>
			<span
				class="border-outline dark:border-outline-dark rounded-full border px-2.5 py-0.5 text-xs font-medium"
			>
				{stack.duration}
			</span>
		</div>
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

	<section class="mb-6">
		<StackTimeline rows={timelineRows} />
	</section>

	<section class="mb-6">
		<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">{s.stack_section_protocol}</h2>
		<p class="text-sm leading-relaxed">{stack.protocol}</p>
	</section>

	<section class="mb-6">
		<h2 class="text-muted mb-2 text-xs font-medium uppercase tracking-wide">
			{s.stack_section_peptides}
		</h2>
		<ul class="space-y-2">
			{#each peptides as p (p.id)}
				{@const t = tierFor(p)}
				<li>
					<a
						href={`/peptides/${p.id}`}
						class="border-outline dark:border-outline-dark hover:border-brand block rounded-2xl border p-4 transition-colors"
					>
						<div class="mb-0.5 flex items-center justify-between">
							<span class="font-semibold">{p.name}</span>
							<span class="text-brand font-mono text-xs">★ {p.popularity}</span>
						</div>
						<div class="text-muted text-xs">{t.amount} · {t.frequency}</div>
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
</article>

<!-- Sticky CTA. Tap creates reminders for every peptide × inferred
     dose time and navigates to /doses with a count for the toast. -->
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

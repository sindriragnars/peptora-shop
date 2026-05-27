<script lang="ts">
	import { timeToPercent } from './scheduling';
	import { prefs } from './prefs.svelte';
	import { strings } from './i18n';

	/* Shared 24-hour timeline for stack detail screens. Each row is a
	   tinted pill spanning a full day; dots sit at the inferred dose
	   times. Used by both /stacks/[id] (suggested) and /stacks/custom/[id]
	   so the visual story is identical regardless of where the stack
	   came from. */

	interface Row {
		name: string;
		/** Hex colour string used for the row's tint and the dot fill. */
		color: string;
		/** "HH:MM" times to plot. */
		times: string[];
	}

	let { rows }: { rows: Row[] } = $props();

	const s = $derived(strings[prefs.lang]);
</script>

<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
	<h3 class="mb-3 font-semibold">{s.stack_timeline_title}</h3>

	<!-- Tick labels above the rows. Aligned with the start/quarter/
	     midpoint/three-quarter/end of the timeline track below. -->
	<div class="text-muted mb-1.5 ml-24 relative h-3 text-[10px]">
		<span class="absolute left-0">0:00</span>
		<span class="absolute left-1/4 -translate-x-1/2">6:00</span>
		<span class="absolute left-1/2 -translate-x-1/2">12:00</span>
		<span class="absolute left-3/4 -translate-x-1/2">18:00</span>
		<span class="absolute right-0 -translate-x-full">24:00</span>
	</div>

	<ul class="space-y-2">
		{#each rows as row (row.name)}
			<li class="flex items-center gap-3">
				<div class="w-24 flex-shrink-0 truncate text-xs font-medium">{row.name}</div>
				<div
					class="relative h-5 flex-1 rounded-full"
					style="background-color: {row.color}25;"
				>
					{#each row.times as t}
						<span
							class="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
							style="left: {timeToPercent(t)}%; background-color: {row.color};"
							aria-label={t}
						></span>
					{/each}
				</div>
			</li>
		{/each}
	</ul>
</div>

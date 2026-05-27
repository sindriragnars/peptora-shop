<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { prefs, type Theme, type Experience, type Gender } from '$lib/prefs.svelte';
	import type { Locale } from '$lib/peptides';
	import { subscribe } from '$lib/newsletter';
	import { strings } from '$lib/i18n';
	import {
		disablePush,
		enablePush,
		getStoredSubId,
		isPushConfigured,
		isPushSupported,
		notificationPermission
	} from '$lib/push';
	import { syncRemindersToBackend } from '$lib/reminders';

	const s = $derived(strings[prefs.lang]);

	// Newsletter form state — lives entirely in this component.
	let newsletterEmail = $state('');
	let newsletterSubmitting = $state(false);
	let newsletterStatus = $state<'idle' | 'ok' | 'error'>('idle');
	let newsletterMsg = $state('');

	// ===== Notifications =====
	// `enabled` reflects what we've persisted server-side (subId in
	// localStorage). `permission` reflects the browser's own state —
	// they can disagree if the user revoked permission from browser
	// settings without using our toggle, hence the explicit re-sync
	// on mount.
	const pushConfigured = isPushConfigured();
	let pushEnabled = $state(false);
	let pushPerm = $state<NotificationPermission | 'unsupported'>('default');
	let pushBusy = $state(false);
	let pushError = $state('');
	// iOS Safari is the only platform that *requires* installation to
	// home screen before push will work. Desktop Chrome/Firefox/Safari
	// and Android Chrome all support push in regular browser tabs.
	// Track both flags so we can show the install nudge only when it
	// actually applies (iOS-in-browser).
	let needsIOSInstall = $state(false);

	onMount(() => {
		if (!browser) return;
		const isStandalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(window.navigator as unknown as { standalone?: boolean }).standalone === true;
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
		needsIOSInstall = isIOS && !isStandalone;
		pushPerm = notificationPermission();
		pushEnabled = !!getStoredSubId() && pushPerm === 'granted';
	});

	async function togglePush() {
		if (pushBusy) return;
		pushBusy = true;
		pushError = '';
		try {
			if (pushEnabled) {
				await disablePush();
				pushEnabled = false;
			} else {
				await enablePush();
				pushEnabled = true;
				pushPerm = 'granted';
				// Mop up any reminders the user saved before they had a
				// subscription — sync them now so QStash starts firing.
				void syncRemindersToBackend();
			}
		} catch (e) {
			const msg = (e as Error).message;
			if (msg === 'permission_denied') {
				pushPerm = 'denied';
				pushError = s.settings_notifications_denied;
			} else if (msg === 'push_unsupported') {
				pushPerm = 'unsupported';
				pushError = s.settings_notifications_unsupported;
			} else {
				pushError = s.settings_notifications_error;
				console.error('push toggle failed', e);
			}
		} finally {
			pushBusy = false;
		}
	}

	async function submitNewsletter(e: Event) {
		e.preventDefault();
		if (newsletterSubmitting) return;
		newsletterSubmitting = true;
		newsletterStatus = 'idle';
		newsletterMsg = '';
		const res = await subscribe(newsletterEmail);
		newsletterSubmitting = false;
		if (res.ok) {
			newsletterStatus = 'ok';
			newsletterMsg = s.settings_newsletter_subscribed;
			newsletterEmail = '';
			prefs.dismissNewsletter(); // also suppresses the Home banner
		} else {
			newsletterStatus = 'error';
			newsletterMsg = res.reason ?? s.error_generic;
		}
	}

	const themes = $derived<{ value: Theme; label: string }[]>([
		{ value: 'light', label: s.settings_theme_light },
		{ value: 'dark', label: s.settings_theme_dark },
		{ value: 'system', label: s.settings_theme_system }
	]);
	// Language labels stay in their native form so the picker is
	// always self-describing regardless of which language is active.
	const langs: { value: Locale; label: string }[] = [
		{ value: 'is', label: 'Íslenska' },
		{ value: 'en', label: 'English' }
	];
	const experiences = $derived<{ value: Experience; label: string }[]>([
		{ value: 'beginner', label: s.settings_experience_beginner },
		{ value: 'standard', label: s.settings_experience_standard },
		{ value: 'advanced', label: s.settings_experience_advanced }
	]);
	const genders = $derived<{ value: Gender; label: string }[]>([
		{ value: 'male', label: s.settings_gender_male },
		{ value: 'female', label: s.settings_gender_female },
		{ value: 'other', label: s.settings_gender_other }
	]);

	async function clearAllData() {
		const ok = confirm(s.settings_clear_confirm);
		if (!ok) return;
		await prefs.clearAllData();
		location.reload();
	}

	// Reactively flip the .dark class whenever the user changes the
	// theme picker (or on initial mount).
	$effect(() => {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		const t = prefs.theme;
		const wantDark =
			t === 'dark' ||
			(t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		root.classList.toggle('dark', wantDark);
	});
</script>

<svelte:head>
	<title>Settings · Peptora</title>
</svelte:head>

{#snippet check()}
	<svg
		class="h-3.5 w-3.5 flex-shrink-0"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="3"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<polyline points="20 6 9 17 4 12" />
	</svg>
{/snippet}

<section class="mx-auto max-w-md p-5">
	<h1 class="mt-2 mb-6 text-3xl font-bold tracking-tight">{s.settings_title}</h1>

	<!-- ===== Profile ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_profile}</h2>
		<div class="border-outline dark:border-outline-dark space-y-4 rounded-2xl border p-4">
			<div>
				<div class="mb-2 text-sm font-medium">{s.settings_experience_label}</div>
				<div
					class="border-outline dark:border-outline-dark flex rounded-full border p-1 text-sm"
					role="radiogroup"
					aria-label={s.settings_experience_label}
				>
					{#each experiences as e (e.value)}
						{@const active = prefs.experience === e.value}
						<button
							type="button"
							role="radio"
							aria-checked={active}
							onclick={() => prefs.setExperience(e.value)}
							class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-colors"
							class:bg-brand={active}
							class:text-white={active}
							class:text-muted={!active}
						>
							{#if active}{@render check()}{/if}
							{e.label}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<div class="mb-2 text-sm font-medium">{s.settings_gender_label}</div>
				<div
					class="border-outline dark:border-outline-dark flex rounded-full border p-1 text-sm"
					role="radiogroup"
					aria-label={s.settings_gender_label}
				>
					{#each genders as g (g.value)}
						{@const active = prefs.gender === g.value}
						<button
							type="button"
							role="radio"
							aria-checked={active}
							onclick={() => prefs.setGender(g.value)}
							class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-colors"
							class:bg-brand={active}
							class:text-white={active}
							class:text-muted={!active}
						>
							{#if active}{@render check()}{/if}
							{g.label}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<!-- ===== Appearance ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_appearance}</h2>
		<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
			<div class="mb-2 text-sm font-medium">{s.settings_theme_label}</div>
			<div
				class="border-outline dark:border-outline-dark flex rounded-full border p-1 text-sm"
				role="radiogroup"
				aria-label={s.settings_theme_label}
			>
				{#each themes as t (t.value)}
					{@const active = prefs.theme === t.value}
					<button
						type="button"
						role="radio"
						aria-checked={active}
						onclick={() => prefs.setTheme(t.value)}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-colors"
						class:bg-brand={active}
						class:text-white={active}
						class:text-muted={!active}
					>
						{#if active}{@render check()}{/if}
						{t.label}
					</button>
				{/each}
			</div>
			<p class="text-muted mt-2 text-xs">
				{s.settings_theme_hint}
			</p>
		</div>
	</section>

	<!-- ===== Language ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_language}</h2>
		<div class="border-outline dark:border-outline-dark rounded-2xl border p-4">
			<div class="mb-2 text-sm font-medium">{s.settings_language_label}</div>
			<div
				class="border-outline dark:border-outline-dark flex rounded-full border p-1 text-sm"
				role="radiogroup"
				aria-label={s.settings_language_label}
			>
				{#each langs as l (l.value)}
					{@const active = prefs.lang === l.value}
					<button
						type="button"
						role="radio"
						aria-checked={active}
						onclick={() => prefs.setLang(l.value)}
						class="flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 font-medium transition-colors"
						class:bg-brand={active}
						class:text-white={active}
						class:text-muted={!active}
					>
						{#if active}{@render check()}{/if}
						{l.label}
					</button>
				{/each}
			</div>
			<p class="text-muted mt-2 text-xs">
				{s.settings_language_hint}
			</p>
		</div>
	</section>

	<!-- ===== Safety ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_safety}</h2>
		<div
			class="border-outline dark:border-outline-dark flex items-center justify-between gap-3 rounded-2xl border p-4"
		>
			<div class="min-w-0 flex-1">
				<div class="text-sm font-medium">{s.settings_warnings_label}</div>
				<div class="text-muted mt-0.5 text-xs">{s.settings_warnings_hint}</div>
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={prefs.safetyWarnings}
				aria-label={s.settings_warnings_label}
				onclick={() => prefs.setSafetyWarnings(!prefs.safetyWarnings)}
				class="relative h-7 w-12 flex-shrink-0 overflow-hidden rounded-full transition-colors"
				class:bg-brand={prefs.safetyWarnings}
				class:bg-outline={!prefs.safetyWarnings}
				class:dark:bg-outline-dark={!prefs.safetyWarnings}
			>
				<!-- 28px tall track, 20px circle → 4px top/bottom inset.
				     Off: circle at left:4, On: slides 20px right
				     (lands at left:24, right edge at 44, inside the
				     48px track with the same 4px breathing room). -->
				<span
					class="absolute h-5 w-5 rounded-full bg-white shadow-sm transition-transform"
					style="top: 4px; left: 4px; transform: translateX({prefs.safetyWarnings
						? '20px'
						: '0'});"
				></span>
			</button>
		</div>
	</section>

	{#if pushConfigured}
		<!-- ===== Notifications (Web Push, v0.5 Phase A) ===== -->
		<section class="mb-8">
			<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">
				{s.settings_section_notifications}
			</h2>
			<div
				class="border-outline dark:border-outline-dark space-y-3 rounded-2xl border p-4 text-sm"
			>
				<div>
					<div class="font-medium">{s.settings_notifications_label}</div>
					<div class="text-muted mt-0.5 text-xs">{s.settings_notifications_hint}</div>
				</div>

				{#if pushPerm === 'unsupported'}
					<p class="text-muted text-xs">{s.settings_notifications_unsupported}</p>
				{:else if needsIOSInstall}
					<!-- iOS Safari blocks push on plain browser tabs even after grant.
					     Tell the user to install first; link to /web-app guide. -->
					<p class="text-muted text-xs">
						{s.settings_notifications_needs_install}
						<a
							href="https://peptora.app/web-app"
							target="_blank"
							rel="noopener noreferrer"
							class="text-brand ml-1 font-medium"
						>
							{s.install_banner_cta} →
						</a>
					</p>
				{:else if pushPerm === 'denied'}
					<p class="text-xs text-amber-700 dark:text-amber-400">
						{s.settings_notifications_denied}
					</p>
				{:else}
					<button
						type="button"
						onclick={togglePush}
						disabled={pushBusy}
						class="w-full rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60"
						class:bg-brand={!pushEnabled}
						class:text-white={!pushEnabled}
						class:border={pushEnabled}
						class:border-outline={pushEnabled}
						class:dark:border-outline-dark={pushEnabled}
					>
						{pushBusy
							? s.settings_notifications_pending
							: pushEnabled
								? s.settings_notifications_disable
								: s.settings_notifications_enable}
					</button>
				{/if}

				{#if pushError && pushPerm !== 'denied' && pushPerm !== 'unsupported'}
					<p class="text-xs text-red-600 dark:text-red-400">{pushError}</p>
				{/if}
			</div>
		</section>
	{/if}

	<!-- ===== Newsletter ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_newsletter}</h2>
		<div class="border-outline dark:border-outline-dark space-y-3 rounded-2xl border p-4 text-sm">
			<div>
				<div class="font-medium">{s.settings_newsletter_label}</div>
				<div class="text-muted mt-0.5 text-xs">
					{s.settings_newsletter_hint}
				</div>
			</div>
			<form onsubmit={submitNewsletter} class="space-y-2">
				<input
					type="email"
					bind:value={newsletterEmail}
					placeholder={s.newsletter_email_placeholder}
					autocomplete="email"
					required
					class="border-outline dark:border-outline-dark focus:border-brand w-full rounded-full border bg-transparent px-4 py-2 text-sm outline-none"
				/>
				<button
					type="submit"
					disabled={newsletterSubmitting}
					class="bg-brand w-full rounded-full py-2 text-sm font-medium text-white disabled:opacity-60"
				>
					{newsletterSubmitting ? s.settings_newsletter_subscribing : s.settings_newsletter_subscribe}
				</button>
				{#if newsletterStatus === 'ok'}
					<p class="text-brand text-xs">{newsletterMsg}</p>
				{:else if newsletterStatus === 'error'}
					<p class="text-xs text-red-600 dark:text-red-400">{newsletterMsg}</p>
				{/if}
			</form>
		</div>
	</section>

	<!-- ===== Data ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_data}</h2>
		<div class="border-outline dark:border-outline-dark space-y-3 rounded-2xl border p-4 text-sm">
			<p>{s.settings_data_summary}</p>
			<button
				type="button"
				onclick={clearAllData}
				class="w-full rounded-full border border-red-500 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
			>
				{s.settings_clear_all}
			</button>
		</div>
	</section>

	<!-- ===== About ===== -->
	<section class="mb-8">
		<h2 class="text-muted mb-3 text-xs font-medium uppercase tracking-wide">{s.settings_section_about}</h2>
		<div class="border-outline dark:border-outline-dark space-y-2 rounded-2xl border p-4 text-sm">
			<p class="flex justify-between">
				<span class="text-muted">{s.settings_about_version}</span><span class="font-mono">0.5.0</span>
			</p>
			<p class="flex justify-between">
				<span class="text-muted">{s.settings_about_build}</span><span class="font-mono">PWA preview</span>
			</p>
			<p class="text-muted text-xs leading-relaxed">
				{s.settings_about_disclaimer}
			</p>
			<p class="mt-3 flex gap-3 text-xs">
				<a
					href="https://peptora.app"
					target="_blank"
					rel="noopener noreferrer"
					class="text-brand hover:underline"
				>
					{s.settings_about_website}
				</a>
				<a
					href="https://peptora.app/privacy"
					target="_blank"
					rel="noopener noreferrer"
					class="text-brand hover:underline"
				>
					{s.settings_about_privacy}
				</a>
			</p>
		</div>
	</section>
</section>

/**
 * Bilingual UI string catalog (English + Icelandic).
 *
 * Single source of truth: Android app's `strings.xml` (values + values-is).
 * When the same UI concept exists in both surfaces we reuse the Android
 * translation verbatim; WebApp-only strings (e.g. quick-action labels
 * on the home grid, newsletter signup copy) get a fresh IS translation
 * written in the same voice.
 *
 * Usage in a Svelte 5 runes component:
 *
 *   import { prefs } from '$lib/prefs.svelte';
 *   import { strings } from '$lib/i18n';
 *   const s = $derived(strings[prefs.lang]);
 *   // …then in the template: {s.home_greeting}
 *
 * `s` is reactive because `prefs.lang` is a $state field, so flipping
 * the language in Settings re-renders every consumer without a full
 * page reload. Peptide content lookups (getAllPeptides(prefs.lang),
 * getCategory(id, prefs.lang) etc.) should also be wrapped in
 * `$derived(...)` for the same reason.
 */

import type { Locale } from './peptides';

interface UIStrings {
	// Bottom nav
	nav_home: string;
	nav_peptides: string;
	nav_stacks: string;
	nav_news: string;
	nav_doses: string;
	nav_shop: string;
	nav_settings: string;

	// Home
	home_greeting: string;
	home_subtitle: string;
	home_search_placeholder: string;
	home_no_matches: string;
	home_matches: (n: number) => string;
	home_quick_stacks: string;
	home_quick_calculator: string;
	home_quick_reminders: string;
	home_quick_tracking: string;
	home_section_categories: string;
	home_section_popular: string;
	newsletter_title: string;
	newsletter_subtitle: string;
	newsletter_email_placeholder: string;
	newsletter_join: string;
	newsletter_dismiss: string;

	// Stacks list
	stacks_title: string;
	stacks_tab_suggested: string;
	stacks_tab_custom: string;
	stacks_build_new: string;
	stacks_custom_empty_title: string;
	stacks_custom_empty_hint: string;
	stacks_custom_badge: string;

	// Stack detail
	stack_back_all: string;
	stack_warnings_title: string;
	stack_timeline_title: string;
	stack_section_protocol: string;
	stack_section_peptides: string;
	stack_disclaimer_title: string;
	stack_disclaimer_body: string;
	stack_start_action: string;
	stack_start_pending: string;
	stack_start_error: string;
	stack_not_found: string;
	stack_delete_confirm: string;
	stack_delete_label: string;

	// Stack builder
	builder_title: string;
	builder_back: string;
	builder_name_label: string;
	builder_name_placeholder: string;
	builder_peptides_label: string;
	builder_no_peptides_yet: string;
	builder_add_peptide: string;
	builder_picker_title: string;
	builder_picker_search: string;
	builder_picker_close: string;
	builder_dose_label: string;
	builder_dose_placeholder: string;
	builder_remove: string;
	builder_warnings_title: string;
	builder_no_warnings: string;
	builder_save: string;
	builder_save_pending: string;
	builder_name_required: string;
	builder_peptides_required: string;

	// Categories & generic
	category_filter_beginner: string;
	category_filter_fda: string;
	category_filter_women: string;
	category_filter_men: string;
	category_empty: string;
	category_all: string;
	category_count: (n: number) => string;
	badge_fda: string;

	// Peptide detail
	peptide_back_all: string;
	peptide_quick_halflife: string;
	peptide_quick_route: string;
	peptide_quick_storage: string;
	peptide_section_about: string;
	peptide_section_dosage: string;
	peptide_section_benefits: string;
	peptide_section_side_effects: string;
	peptide_section_cautions: string;
	peptide_section_gender: string;
	peptide_section_timing: string;
	peptide_section_stacks_well_with: string;
	peptide_section_research: string;
	peptide_section_reconstitution: string;
	peptide_recon_reference: string;
	peptide_recon_reference_note: string;
	peptide_recon_th_vial: string;
	peptide_recon_th_water: string;
	peptide_recon_th_draw: string;
	peptide_recon_units_suffix: string;
	peptide_fda_badge: string;
	peptide_dose_tab_beginner: string;
	peptide_dose_tab_standard: string;
	peptide_dose_tab_advanced: string;
	peptide_dose_frequency: string;
	peptide_dose_duration: string;
	peptide_dose_route: string;
	peptide_dose_syringe_units: (n: number) => string;
	peptide_gender_men: string;
	peptide_gender_women: string;
	peptide_timing_when: string;
	peptide_timing_cycle: string;
	peptide_mechanism_label: string;
	peptide_research_open: string;
	peptide_action_add_reminder: string;
	peptide_action_open_calculator: string;
	peptide_disclaimer: string;

	// Calculator
	calc_title: string;
	calc_subtitle: string;
	calc_label_vial: string;
	calc_label_water: string;
	calc_label_dose: string;
	calc_label_syringe: string;
	calc_units_label: string;
	calc_units_suffix: (ml: number) => string;
	calc_overdraw: string;
	calc_concentration: string;
	calc_doses_per_vial: string;
	calc_days: string;
	calc_disclaimer: string;
	calc_pick_peptide: string;
	calc_manual: string;
	calc_dose_range: (low: string, high: string, unit: string) => string;
	calc_copy_link: string;
	calc_copied: string;

	// Doses (Reminders + Tracking)
	doses_title: string;
	doses_tab_reminders: string;
	doses_tab_tracking: string;
	doses_tab_vials: string;
	vials_empty: string;
	vials_add_title: string;
	vials_peptide: string;
	vials_size: string;
	vials_qty: string;
	vials_mix_later: string;
	vials_mix_now: string;
	vials_bac: string;
	vials_save: string;
	vials_unmixed: string;
	vials_group_mixed: string;
	vials_group_unmixed: string;
	vials_mix: string;
	vials_delete: string;
	vials_edit: string;
	vials_mixed_date: string;
	vials_unmix: string;
	vials_unmix_confirm: string;
	vials_expired: string;
	vials_approx: string;
	bac_title: string;
	bac_add: string;
	bac_delete: string;
	bac_edit: string;
	bac_size: string;
	bac_save: string;
	bac_left: (left: string, total: string) => string;
	vials_remaining: (left: string, total: string) => string;
	vials_use_by: (date: string, days: string) => string;
	vials_delete_stack: (n: string) => string;
	doses_created_toast: (n: number) => string;
	doses_dismiss: string;
	doses_picker_choose_different: string;
	reminders_toggle_on: string;
	reminders_toggle_off: string;
	tracking_heatmap_less: string;
	tracking_heatmap_more: string;

	// Stack-goal badge labels (suggested-stack cards + detail header)
	stack_goal_muscle: string;
	stack_goal_healing: string;
	stack_goal_fat_loss: string;
	stack_goal_anti_aging: string;
	stack_goal_cognitive: string;
	stack_goal_longevity: string;

	// Reminders
	reminders_empty: string;
	reminders_add: string;
	reminders_delete: string;
	reminders_pending_push: string;
	reminders_at: string;
	reminders_days_daily: string;
	reminders_days_weekdays: string;
	reminders_days_weekends: string;
	add_reminder_title: string;
	add_reminder_peptide: string;
	add_reminder_pick: string;
	add_reminder_dose: string;
	add_reminder_time: string;
	add_reminder_days: string;
	add_reminder_save: string;
	add_reminder_cancel: string;
	add_reminder_close: string;
	add_reminder_protocol: string;
	add_reminder_start_date: string;
	add_reminder_duration: string;
	add_reminder_forever: string;
	add_reminder_custom: string;
	add_reminder_end_date: string;
	weeks_label: string;
	reminder_protocol_finished: string;
	reminder_protocol_one_day_left: string;
	reminder_protocol_days_left: string;
	reminder_protocol_weeks_left: string;
	log_dose_date: string;
	log_dose_time: string;
	tracking_day_empty: string;
	day_short_sun: string;
	day_short_mon: string;
	day_short_tue: string;
	day_short_wed: string;
	day_short_thu: string;
	day_short_fri: string;
	day_short_sat: string;

	// Tracking
	tracking_empty: string;
	tracking_needs_vials: string;
	tracking_log_dose: string;
	tracking_stat_streak: string;
	tracking_stat_month: string;
	tracking_stat_top: string;
	tracking_heatmap_title: string;
	tracking_recent_title: string;
	log_dose_title: string;
	log_dose_edit: string;
	log_dose_peptide: string;
	log_dose_amount: string;
	log_dose_notes: string;
	log_dose_save: string;
	log_dose_today: string;
	log_dose_yesterday: string;
	log_dose_vial: string;
	log_dose_syringe: string;
	log_dose_units: string;
	log_dose_draw: (mcg: string, ml: string) => string;
	log_dose_no_mixed: string;
	tracking_units: string;
	unit_mcg: string;
	unit_mg: string;

	// Onboarding
	onboarding_lang_choose: string;
	onboarding_welcome_title: string;
	onboarding_welcome_body: string;
	onboarding_get_started: string;
	onboarding_experience_title: string;
	onboarding_experience_hint: string;
	onboarding_experience_beginner_label: string;
	onboarding_experience_beginner_hint: string;
	onboarding_experience_standard_label: string;
	onboarding_experience_standard_hint: string;
	onboarding_experience_advanced_label: string;
	onboarding_experience_advanced_hint: string;
	onboarding_gender_title: string;
	onboarding_gender_hint: string;
	onboarding_gender_male: string;
	onboarding_gender_female: string;
	onboarding_gender_other: string;
	onboarding_disclaimer_title: string;
	onboarding_disclaimer_body_1: string;
	onboarding_disclaimer_body_2: string;
	onboarding_disclaimer_body_3: string;
	onboarding_disclaimer_action: string;
	onboarding_email_title: string;
	onboarding_email_body: string;
	onboarding_email_placeholder: string;
	onboarding_email_subscribe: string;
	onboarding_email_subscribing: string;
	onboarding_email_skip: string;
	onboarding_back: string;
	install_banner_title: string;
	install_banner_body: string;
	install_banner_cta: string;
	install_banner_dismiss: string;

	// Settings
	settings_title: string;
	settings_section_profile: string;
	settings_section_appearance: string;
	settings_section_language: string;
	settings_section_safety: string;
	settings_section_notifications: string;
	settings_notifications_label: string;
	settings_notifications_hint: string;
	settings_notifications_enable: string;
	settings_notifications_disable: string;
	settings_notifications_pending: string;
	settings_notifications_unsupported: string;
	settings_notifications_denied: string;
	settings_notifications_needs_install: string;
	settings_notifications_error: string;
	settings_section_newsletter: string;
	settings_section_data: string;
	settings_section_about: string;
	settings_experience_label: string;
	settings_gender_label: string;
	settings_theme_label: string;
	settings_theme_light: string;
	settings_theme_dark: string;
	settings_theme_system: string;
	settings_theme_hint: string;
	settings_language_label: string;
	settings_language_hint: string;
	settings_warnings_label: string;
	settings_warnings_hint: string;
	settings_newsletter_label: string;
	settings_newsletter_hint: string;
	settings_newsletter_subscribed: string;
	settings_newsletter_subscribing: string;
	settings_newsletter_subscribe: string;
	settings_data_summary: string;
	settings_clear_all: string;
	settings_clear_confirm: string;
	settings_about_version: string;
	settings_about_build: string;
	settings_about_disclaimer: string;
	settings_about_website: string;
	settings_about_privacy: string;
	settings_experience_beginner: string;
	settings_experience_standard: string;
	settings_experience_advanced: string;
	settings_gender_male: string;
	settings_gender_female: string;
	settings_gender_other: string;

	// News
	news_title: string;
	news_subtitle: string;
	news_empty_title: string;
	news_empty_subtitle: string;
	news_error_title: string;
	news_error_subtitle: string;
	news_retry: string;
	news_read_more: string;
	news_category_research: string;
	news_category_protocol: string;
	news_category_product: string;
	news_category_industry: string;

	// Errors / generic
	error_generic: string;
	loading: string;
}

const en: UIStrings = {
	nav_home: 'Home',
	nav_peptides: 'Peptides',
	nav_stacks: 'Stacks',
	nav_news: 'News',
	nav_doses: 'My Stuff',
	nav_shop: 'Shop',
	nav_settings: 'Settings',

	home_greeting: 'Good day',
	home_subtitle: 'Explore peptides, build stacks, track doses.',
	home_search_placeholder: 'Search peptides...',
	home_no_matches: 'No peptides matching',
	home_matches: (n) => `${n} match${n === 1 ? '' : 'es'}`,
	home_quick_stacks: 'Stacks',
	home_quick_calculator: 'Calculator',
	home_quick_reminders: 'Reminders',
	home_quick_tracking: 'Tracking',
	home_section_categories: 'Categories',
	home_section_popular: 'Popular peptides',
	newsletter_title: 'Stay in the loop',
	newsletter_subtitle: 'Occasional updates on new peptides, protocols, and vetted sources.',
	newsletter_email_placeholder: 'your@email.com',
	newsletter_join: 'Join',
	newsletter_dismiss: 'Dismiss',

	stacks_title: 'Stacks',
	stacks_tab_suggested: 'Suggested',
	stacks_tab_custom: 'Custom',
	stacks_build_new: 'Build a new stack',
	stacks_custom_empty_title: 'No custom stacks yet.',
	stacks_custom_empty_hint: 'Pick peptides, set doses, save — all stays on your device.',
	stacks_custom_badge: 'Custom',

	stack_back_all: 'All stacks',
	stack_warnings_title: 'Interaction warnings',
	stack_timeline_title: '24-hour timeline',
	stack_section_protocol: 'Protocol',
	stack_section_peptides: 'Peptides in this stack',
	stack_disclaimer_title: 'Not medical advice',
	stack_disclaimer_body:
		'Educational reference. Many peptides discussed are research compounds not FDA-approved. Consult a qualified healthcare provider before starting any protocol.',
	stack_start_action: 'Start this stack',
	stack_start_pending: 'Creating reminders…',
	stack_start_error: 'Could not create reminders.',
	stack_not_found: 'Stack not found — it may have been deleted on another device.',
	stack_delete_confirm: 'Delete this stack?',
	stack_delete_label: 'Delete stack',

	builder_title: 'New stack',
	builder_back: 'All stacks',
	builder_name_label: 'Name',
	builder_name_placeholder: 'My stack',
	builder_peptides_label: 'Peptides',
	builder_no_peptides_yet: 'No peptides yet.',
	builder_add_peptide: 'Add peptide',
	builder_picker_title: 'Pick a peptide',
	builder_picker_search: 'Search peptides…',
	builder_picker_close: 'Close',
	builder_dose_label: 'Dose',
	builder_dose_placeholder: 'e.g. 250 mcg',
	builder_remove: 'Remove',
	builder_warnings_title: 'Interaction warnings',
	builder_no_warnings: 'No known conflicts.',
	builder_save: 'Save stack',
	builder_save_pending: 'Saving…',
	builder_name_required: 'Give your stack a name.',
	builder_peptides_required: 'Add at least one peptide.',

	category_filter_beginner: 'Beginner-friendly',
	category_filter_fda: 'FDA Approved',
	category_filter_women: 'Women',
	category_filter_men: 'Men',
	category_empty: 'No peptides match these filters.',
	category_all: 'All',
	category_count: (n) => `${n} peptide${n === 1 ? '' : 's'}`,
	badge_fda: 'FDA',

	peptide_back_all: 'All peptides',
	peptide_quick_halflife: 'Half-life',
	peptide_quick_route: 'Route',
	peptide_quick_storage: 'Storage',
	peptide_section_about: 'About',
	peptide_section_dosage: 'Dosage',
	peptide_section_benefits: 'Benefits',
	peptide_section_side_effects: 'Side effects',
	peptide_section_cautions: 'Cautions',
	peptide_section_gender: 'Gender notes',
	peptide_section_timing: 'Timing & Cycle',
	peptide_section_stacks_well_with: 'Stacks well with',
	peptide_section_research: 'Research',
	peptide_section_reconstitution: 'Reconstitution',
	peptide_recon_reference: 'Dosing reference',
	peptide_recon_reference_note: 'Units to draw at the typical dose range, per vial size.',
	peptide_recon_th_vial: 'Vial',
	peptide_recon_th_water: 'Water',
	peptide_recon_th_draw: 'Typical draw',
	peptide_recon_units_suffix: 'units',
	peptide_fda_badge: 'FDA approved',
	peptide_dose_tab_beginner: 'Beginner',
	peptide_dose_tab_standard: 'Standard',
	peptide_dose_tab_advanced: 'Advanced',
	peptide_dose_frequency: 'Frequency',
	peptide_dose_duration: 'Duration',
	peptide_dose_route: 'Route',
	peptide_dose_syringe_units: (n) => `Draw to ${n} units on a U-100 insulin syringe`,
	peptide_gender_men: 'Men',
	peptide_gender_women: 'Women',
	peptide_timing_when: 'When to take',
	peptide_timing_cycle: 'Cycle',
	peptide_mechanism_label: 'Mechanism',
	peptide_research_open: 'Open paper',
	peptide_action_add_reminder: 'Add reminder',
	peptide_action_open_calculator: 'Calculator',
	peptide_disclaimer:
		'Educational reference only. Not medical advice. Consult a qualified provider before starting any protocol.',

	calc_title: 'Reconstitution calculator',
	calc_subtitle: 'Mix peptide powder with bacteriostatic water',
	calc_label_vial: 'Vial size (mg)',
	calc_label_water: 'BAC water (mL)',
	calc_label_dose: 'Desired dose (mg)',
	calc_label_syringe: 'Syringe',
	calc_units_label: 'Draw to',
	calc_units_suffix: (ml) => `on a ${ml} mL syringe`,
	calc_overdraw: "Won't fit — pick a larger syringe.",
	calc_concentration: 'Concentration',
	calc_doses_per_vial: 'Uses per vial',
	calc_days: 'Days at 2×/week',
	calc_disclaimer:
		'For reconstitution math only. Not medical advice — always consult a healthcare provider before dosing.',
	calc_pick_peptide: 'Pick a peptide to autofill',
	calc_manual: 'Manual entry',
	calc_dose_range: (low, high, unit) => `Typical dose: ${low}–${high} ${unit}`,
	calc_copy_link: 'Copy shareable link',
	calc_copied: 'Link copied',

	doses_title: 'My Stuff',
	doses_tab_reminders: 'Reminders',
	doses_tab_tracking: 'Tracking',
	doses_tab_vials: 'My vials',
	vials_empty: 'No vials yet. Tap + to add what you own.',
	vials_add_title: 'Add vial',
	vials_peptide: 'Peptide',
	vials_size: 'Vial size (mg)',
	vials_qty: 'How many vials',
	vials_mix_later: 'Added as unmixed powder — mix one at a time from the list.',
	vials_mix_now: 'Mix now — BAC water (mL), leave empty if still powder',
	vials_bac: 'BAC water (mL)',
	vials_save: 'Save vial',
	vials_unmixed: 'unmixed powder',
	vials_group_mixed: 'Mixed — in use',
	vials_group_unmixed: 'Unmixed — in stock',
	vials_mix: 'Mix',
	vials_delete: 'Delete vial',
	vials_edit: 'Edit vial',
	vials_mixed_date: 'Mixed on',
	vials_unmix: 'Mark as unmixed',
	vials_unmix_confirm:
		'Put this vial back to unmixed powder? The BAC water returns to its bottle and the mix date is lost.',
	vials_expired: 'Past its 28-day window',
	vials_approx: 'Remaining is estimated from the doses you have logged.',
	bac_title: 'Bacteriostatic water',
	bac_add: 'Add bottle',
	bac_delete: 'Remove',
	bac_edit: 'Edit',
	bac_size: 'Bottle size (mL)',
	bac_save: 'Save',
	bac_left: (left, total) => `${left} mL left of ${total} mL`,
	vials_remaining: (left, total) => `${left} mg left of ${total} mg`,
	vials_use_by: (date, days) => `Use by ${date} · ${days} days left`,
	vials_delete_stack: (n) => `Delete all ${n} vials in this stack?`,
	doses_created_toast: (n) => `${n} ${n === 1 ? 'reminder' : 'reminders'} created from your stack.`,
	doses_dismiss: 'Dismiss',
	doses_picker_choose_different: '← Choose a different peptide',
	reminders_toggle_on: 'On',
	reminders_toggle_off: 'Off',
	tracking_heatmap_less: 'Less',
	tracking_heatmap_more: 'More',

	stack_goal_muscle: 'Muscle',
	stack_goal_healing: 'Healing',
	stack_goal_fat_loss: 'Fat loss',
	stack_goal_anti_aging: 'Anti-aging',
	stack_goal_cognitive: 'Cognitive',
	stack_goal_longevity: 'Longevity',

	reminders_empty: 'No reminders yet. Tap “+” to add one.',
	reminders_add: 'Add reminder',
	reminders_delete: 'Delete',
	reminders_pending_push:
		"Reminders save now but won't ping your phone until v0.4 ships Web Push. Treat them as a protocol checklist for now.",
	reminders_at: 'at',
	reminders_days_daily: 'Daily',
	reminders_days_weekdays: 'Weekdays',
	reminders_days_weekends: 'Weekends',
	add_reminder_title: 'New reminder',
	add_reminder_peptide: 'Peptide',
	add_reminder_pick: 'Pick a peptide',
	add_reminder_dose: 'Dose',
	add_reminder_time: 'Time',
	add_reminder_days: 'Repeat on',
	add_reminder_save: 'Save reminder',
	add_reminder_cancel: 'Cancel',
	add_reminder_close: 'Close',
	add_reminder_protocol: 'Protocol (optional)',
	add_reminder_start_date: 'Start',
	add_reminder_duration: 'Duration',
	add_reminder_forever: 'Ongoing',
	add_reminder_custom: 'Custom date',
	add_reminder_end_date: 'Ends',
	weeks_label: 'weeks',
	reminder_protocol_finished: 'Finished',
	reminder_protocol_one_day_left: '1 day left',
	reminder_protocol_days_left: '{n} days left',
	reminder_protocol_weeks_left: '{n} weeks left',
	log_dose_date: 'Date',
	log_dose_time: 'Time',
	tracking_day_empty: 'No doses logged this day.',
	day_short_sun: 'Su',
	day_short_mon: 'Mo',
	day_short_tue: 'Tu',
	day_short_wed: 'We',
	day_short_thu: 'Th',
	day_short_fri: 'Fr',
	day_short_sat: 'Sa',

	tracking_empty: 'No doses logged yet. Tap “Log dose” to start.',
	tracking_needs_vials: 'Add a vial under My vials first — doses are logged against what you own.',
	tracking_log_dose: 'Log dose',
	tracking_stat_streak: 'Day streak',
	tracking_stat_month: 'This month',
	tracking_stat_top: 'Most taken',
	tracking_heatmap_title: 'Last 5 weeks',
	tracking_recent_title: 'Recent doses',
	log_dose_title: 'Log a dose',
	log_dose_edit: 'Edit dose',
	log_dose_vial: 'From which vial',
	log_dose_syringe: 'Syringe',
	log_dose_units: 'Units drawn',
	log_dose_draw: (mcg, ml) => `= ${mcg} · ${ml} mL`,
	log_dose_no_mixed: 'Mix a vial under My vials first — doses are drawn from a mixed vial.',
	tracking_units: 'units',
	unit_mcg: 'mcg',
	unit_mg: 'mg',
	log_dose_peptide: 'Peptide',
	log_dose_amount: 'Amount',
	log_dose_notes: 'Notes (optional)',
	log_dose_save: 'Log dose',
	log_dose_today: 'Today',
	log_dose_yesterday: 'Yesterday',

	onboarding_lang_choose: 'Choose your language · Veldu tungumál',
	onboarding_welcome_title: 'Welcome to Peptora',
	onboarding_welcome_body:
		'Your pocket reference for peptide protocols — dosage calculator, stacks, reminders. Everything stays on this device.',
	onboarding_get_started: 'Get started',
	onboarding_experience_title: "What's your experience level?",
	onboarding_experience_hint: "We'll tailor recommendations to match.",
	onboarding_experience_beginner_label: 'Beginner',
	onboarding_experience_beginner_hint: 'New to peptides — show me the basics.',
	onboarding_experience_standard_label: 'Standard',
	onboarding_experience_standard_hint: 'I have some experience with protocols.',
	onboarding_experience_advanced_label: 'Advanced',
	onboarding_experience_advanced_hint: 'Comfortable stacking and titrating doses.',
	onboarding_gender_title: 'How do you identify?',
	onboarding_gender_hint:
		'Some peptides have gender-specific dosing notes — this lets us highlight what matters for you.',
	onboarding_gender_male: 'Male',
	onboarding_gender_female: 'Female',
	onboarding_gender_other: 'Other',
	onboarding_disclaimer_title: 'Before you start',
	onboarding_disclaimer_body_1:
		'Peptora is for educational use only. Many peptides discussed are research compounds not approved by the FDA or other regulators for human use.',
	onboarding_disclaimer_body_2:
		'Nothing here is medical advice. Always consult a qualified healthcare provider before starting, changing, or stopping any protocol.',
	onboarding_disclaimer_body_3:
		'By continuing you acknowledge that you take full responsibility for any decisions you make based on information in this app.',
	onboarding_disclaimer_action: 'I understand',
	onboarding_email_title: 'Stay in the loop',
	onboarding_email_body:
		'Get occasional updates on new peptides, protocols and vetted sources. No spam, unsubscribe anytime. Totally optional.',
	onboarding_email_placeholder: 'your@email.com',
	onboarding_email_subscribe: 'Subscribe & continue',
	onboarding_email_subscribing: 'Subscribing…',
	onboarding_email_skip: 'Skip for now',
	onboarding_back: 'Back',
	install_banner_title: 'Add to your home screen',
	install_banner_body: 'Peptora is designed for your phone. Install it for full-screen, offline access.',
	install_banner_cta: 'See how',
	install_banner_dismiss: 'Dismiss',

	settings_title: 'Settings',
	settings_section_profile: 'Profile',
	settings_section_appearance: 'Appearance',
	settings_section_language: 'Language',
	settings_section_safety: 'Safety',
	settings_section_notifications: 'Notifications',
	settings_notifications_label: 'Dose reminders & news',
	settings_notifications_hint:
		'Get a phone notification when a reminder is due or a new article lands.',
	settings_notifications_enable: 'Enable notifications',
	settings_notifications_disable: 'Disable',
	settings_notifications_pending: 'Setting up…',
	settings_notifications_unsupported:
		'Your browser does not support web push notifications.',
	settings_notifications_denied:
		'You blocked notifications. Open your browser site settings to re-enable.',
	settings_notifications_needs_install:
		'On iPhone, install Peptora to your home screen first — notifications only work in installed mode.',
	settings_notifications_error: 'Could not enable. Try again.',
	settings_section_newsletter: 'Newsletter',
	settings_section_data: 'Your data',
	settings_section_about: 'About',
	settings_experience_label: 'Experience level',
	settings_gender_label: 'Gender',
	settings_theme_label: 'Theme',
	settings_theme_light: 'Light',
	settings_theme_dark: 'Dark',
	settings_theme_system: 'System',
	settings_theme_hint: "System follows your phone's setting and switches automatically.",
	settings_language_label: 'App language',
	settings_language_hint: 'Switches the UI immediately. Peptide content swaps too.',
	settings_warnings_label: 'Show safety warnings',
	settings_warnings_hint: 'Display disclaimers on dose-related screens.',
	settings_newsletter_label: 'Updates from Peptora',
	settings_newsletter_hint:
		'Occasional emails about new peptides, protocols and vetted sources. Unsubscribe any time.',
	settings_newsletter_subscribed: "You're on the list. Thanks!",
	settings_newsletter_subscribing: 'Subscribing…',
	settings_newsletter_subscribe: 'Subscribe',
	settings_data_summary:
		'Everything Peptora knows about you — custom stacks, dose history, reminders, preferences — lives only on this device. There is no cloud, no account.',
	settings_clear_all: 'Clear all data',
	settings_clear_confirm:
		'Delete all reminders, dose history, custom stacks and preferences? This cannot be undone.',
	settings_about_version: 'Version',
	settings_about_build: 'Build',
	settings_about_disclaimer:
		'Peptora is for educational use only. Many peptides discussed are research compounds not FDA-approved. Always consult a qualified healthcare provider before starting, changing, or stopping any protocol.',
	settings_about_website: 'peptora.app',
	settings_about_privacy: 'Privacy policy',
	settings_experience_beginner: 'Beginner',
	settings_experience_standard: 'Standard',
	settings_experience_advanced: 'Advanced',
	settings_gender_male: 'Male',
	settings_gender_female: 'Female',
	settings_gender_other: 'Other',

	news_title: 'News',
	news_subtitle: 'Fresh peptide research and protocol notes.',
	news_empty_title: 'No articles yet',
	news_empty_subtitle: 'Check back later — fresh content lands regularly.',
	news_error_title: "Couldn't load articles",
	news_error_subtitle: 'Check your connection and try again.',
	news_retry: 'Try again',
	news_read_more: 'Read on peptora.app',
	news_category_research: 'Research',
	news_category_protocol: 'Protocol',
	news_category_product: 'Product',
	news_category_industry: 'News',

	error_generic: 'Something went wrong.',
	loading: 'Loading…'
};

const is: UIStrings = {
	nav_home: 'Heim',
	nav_peptides: 'Peptíð',
	nav_stacks: 'Stacks',
	nav_news: 'Fréttir',
	nav_doses: 'Mitt dót',
	nav_shop: 'Verslun',
	nav_settings: 'Stillingar',

	home_greeting: 'Góðan dag',
	home_subtitle: 'Skoðaðu peptíð, byggðu stacks, fylgstu með skömmtum.',
	home_search_placeholder: 'Leita að peptíðum…',
	home_no_matches: 'Engin peptíð passa við',
	home_matches: (n) => `${n} ${n === 1 ? 'niðurstaða' : 'niðurstöður'}`,
	home_quick_stacks: 'Stacks',
	home_quick_calculator: 'Reiknivél',
	home_quick_reminders: 'Áminningar',
	home_quick_tracking: 'Skráning',
	home_section_categories: 'Flokkar',
	home_section_popular: 'Vinsæl peptíð',
	newsletter_title: 'Fylgstu með',
	newsletter_subtitle:
		'Stöku fréttir um ný peptíð, skammtaáætlanir og vottaðar heimildir.',
	newsletter_email_placeholder: 'netfang@example.com',
	newsletter_join: 'Skrá',
	newsletter_dismiss: 'Loka',

	stacks_title: 'Stacks',
	stacks_tab_suggested: 'Tilbúnir',
	stacks_tab_custom: 'Þínir',
	stacks_build_new: 'Búa til nýjan stack',
	stacks_custom_empty_title: 'Engir eigin stacks ennþá.',
	stacks_custom_empty_hint:
		'Veldu peptíð, settu skammta, vistaðu — allt helst á þessu tæki.',
	stacks_custom_badge: 'Eigin',

	stack_back_all: 'Allir stacks',
	stack_warnings_title: 'Samverkunarviðvaranir',
	stack_timeline_title: '24-klst tímalína',
	stack_section_protocol: 'Skammtaáætlun',
	stack_section_peptides: 'Peptíð í þessum stack',
	stack_disclaimer_title: 'Ekki læknisráð',
	stack_disclaimer_body:
		'Fræðsluefni. Mörg peptíð hér eru rannsóknarefni og ekki FDA-samþykkt. Ráðfærðu þig við hæfan heilbrigðisstarfsmann áður en þú byrjar protocol.',
	stack_start_action: 'Byrja á þessum stack',
	stack_start_pending: 'Bý til áminningar…',
	stack_start_error: 'Tókst ekki að búa til áminningar.',
	stack_not_found: 'Stack fannst ekki — gæti hafa verið eytt á öðru tæki.',
	stack_delete_confirm: 'Eyða þessum stack?',
	stack_delete_label: 'Eyða stack',

	builder_title: 'Nýr stack',
	builder_back: 'Allir stacks',
	builder_name_label: 'Nafn',
	builder_name_placeholder: 'Minn stack',
	builder_peptides_label: 'Peptíð',
	builder_no_peptides_yet: 'Engin peptíð valin.',
	builder_add_peptide: 'Bæta við peptíði',
	builder_picker_title: 'Veldu peptíð',
	builder_picker_search: 'Leita að peptíðum…',
	builder_picker_close: 'Loka',
	builder_dose_label: 'Skammtur',
	builder_dose_placeholder: 't.d. 250 mcg',
	builder_remove: 'Fjarlægja',
	builder_warnings_title: 'Samverkunarviðvaranir',
	builder_no_warnings: 'Engin þekkt vandamál.',
	builder_save: 'Vista stack',
	builder_save_pending: 'Vista…',
	builder_name_required: 'Gefðu stackinu nafn.',
	builder_peptides_required: 'Bættu við a.m.k. einu peptíði.',

	category_filter_beginner: 'Fyrir byrjendur',
	category_filter_fda: 'FDA samþykkt',
	category_filter_women: 'Konur',
	category_filter_men: 'Karlar',
	category_empty: 'Engin peptíð passa við þessar síur.',
	category_all: 'Öll',
	category_count: (n) => `${n} peptíð`,
	badge_fda: 'FDA',

	peptide_back_all: 'Öll peptíð',
	peptide_quick_halflife: 'Helmingunartími',
	peptide_quick_route: 'Leið',
	peptide_quick_storage: 'Geymsla',
	peptide_section_about: 'Um peptíðið',
	peptide_section_dosage: 'Skammtur',
	peptide_section_benefits: 'Kostir',
	peptide_section_side_effects: 'Aukaverkanir',
	peptide_section_cautions: 'Varúð',
	peptide_section_gender: 'Eftir kyni',
	peptide_section_timing: 'Tímasetning og lota',
	peptide_section_stacks_well_with: 'Virkar vel með',
	peptide_section_research: 'Rannsóknir',
	peptide_section_reconstitution: 'Blöndun',
	peptide_recon_reference: 'Skammtatafla',
	peptide_recon_reference_note: 'Einingar til að draga upp á dæmigerðu skammtabili, eftir glasastærð.',
	peptide_recon_th_vial: 'Glas',
	peptide_recon_th_water: 'Vatn',
	peptide_recon_th_draw: 'Dæmigert',
	peptide_recon_units_suffix: 'ein.',
	peptide_fda_badge: 'FDA samþykkt',
	peptide_dose_tab_beginner: 'Byrjandi',
	peptide_dose_tab_standard: 'Staðall',
	peptide_dose_tab_advanced: 'Lengra kominn',
	peptide_dose_frequency: 'Tíðni',
	peptide_dose_duration: 'Lengd',
	peptide_dose_route: 'Leið',
	peptide_dose_syringe_units: (n) => `Draga upp að ${n} einingum á U-100 insúlínsprautu`,
	peptide_gender_men: 'Karlar',
	peptide_gender_women: 'Konur',
	peptide_timing_when: 'Hvenær á að taka',
	peptide_timing_cycle: 'Lota',
	peptide_mechanism_label: 'Verkun',
	peptide_research_open: 'Lesa grein',
	peptide_action_add_reminder: 'Bæta áminning',
	peptide_action_open_calculator: 'Reiknivél',
	peptide_disclaimer:
		'Aðeins fræðsluefni. Ekki læknisráð. Ráðfærðu þig við lækni áður en þú byrjar protocol.',

	calc_title: 'Blöndunarreiknivél',
	calc_subtitle: 'Blanda peptíð duft með BAC vatni',
	calc_label_vial: 'Stærð á glasi (mg)',
	calc_label_water: 'BAC vatn (mL)',
	calc_label_dose: 'Æskilegur skammtur (mg)',
	calc_label_syringe: 'Sprauta',
	calc_units_label: 'Draga upp að',
	calc_units_suffix: (ml) => `á ${ml} mL sprautu`,
	calc_overdraw: 'Passar ekki — veldu stærri sprautu.',
	calc_concentration: 'Þéttleiki',
	calc_doses_per_vial: 'Notkanir í glasi',
	calc_days: 'Dagar (2×/viku)',
	calc_disclaimer:
		'Aðeins fyrir blöndun og umreikning. Ekki læknisráð — ráðfærðu þig alltaf við lækni áður en þú tekur skammt.',
	calc_pick_peptide: 'Veldu peptíð til að fylla út',
	calc_manual: 'Handvirk færsla',
	calc_dose_range: (low, high, unit) => `Dæmigerður skammtur: ${low}–${high} ${unit}`,
	calc_copy_link: 'Afrita deilanlegan hlekk',
	calc_copied: 'Hlekkur afritaður',

	doses_title: 'Mitt dót',
	doses_tab_reminders: 'Áminningar',
	doses_tab_tracking: 'Skráning',
	doses_tab_vials: 'Mín glös',
	vials_empty: 'Engin glös skráð. Ýttu á + til að skrá það sem þú átt.',
	vials_add_title: 'Skrá glas',
	vials_peptide: 'Peptíð',
	vials_size: 'Stærð glass (mg)',
	vials_qty: 'Hversu mörg glös',
	vials_mix_later: 'Skráð sem óblandað duft — blandaðu einu í einu úr listanum.',
	vials_mix_now: 'Blanda strax — BAC vatn (mL), skildu eftir tómt ef enn duft',
	vials_bac: 'BAC vatn (mL)',
	vials_save: 'Vista glas',
	vials_unmixed: 'óblandað duft',
	vials_group_mixed: 'Blandað — í notkun',
	vials_group_unmixed: 'Óblandað — á lager',
	vials_mix: 'Blanda',
	vials_delete: 'Eyða glasi',
	vials_edit: 'Breyta glasi',
	vials_mixed_date: 'Blandað þann',
	vials_unmix: 'Merkja sem óblandað',
	vials_unmix_confirm:
		'Setja glasið aftur í óblandað duft? BAC vatnið fer aftur á flöskuna og blöndunardagsetningin tapast.',
	vials_expired: 'Komið fram yfir 28 daga',
	vials_approx: 'Afgangur er áætlaður út frá skráðum skömmtum.',
	bac_title: 'BAC vatn',
	bac_add: 'Bæta við flösku',
	bac_delete: 'Fjarlægja',
	bac_edit: 'Breyta',
	bac_size: 'Stærð flösku (mL)',
	bac_save: 'Vista',
	bac_left: (left, total) => `${left} mL eftir af ${total} mL`,
	vials_remaining: (left, total) => `${left} mg eftir af ${total} mg`,
	vials_use_by: (date, days) => `Nota fyrir ${date} · ${days} dagar eftir`,
	vials_delete_stack: (n) => `Eyða öllum ${n} glösunum í þessari stæðu?`,
	doses_created_toast: (n) =>
		`${n} ${n === 1 ? 'áminning' : 'áminningar'} búnar til úr stack-num þínum.`,
	doses_dismiss: 'Loka',
	doses_picker_choose_different: '← Veldu annað peptíð',
	reminders_toggle_on: 'Á',
	reminders_toggle_off: 'Af',
	tracking_heatmap_less: 'Færri',
	tracking_heatmap_more: 'Fleiri',

	stack_goal_muscle: 'Vöðvar',
	stack_goal_healing: 'Endurheimt',
	stack_goal_fat_loss: 'Fitubrennsla',
	stack_goal_anti_aging: 'Heilbrigð öldrun',
	stack_goal_cognitive: 'Hugræn geta',
	stack_goal_longevity: 'Langlífi',

	reminders_empty: 'Engar áminningar ennþá. Smelltu á „+“ til að bæta við.',
	reminders_add: 'Bæta áminning',
	reminders_delete: 'Eyða',
	reminders_pending_push:
		'Áminningar vistast núna en pinga ekki símann fyrr en v0.4 með Web Push. Notaðu þær sem checklist í bili.',
	reminders_at: 'kl.',
	reminders_days_daily: 'Daglega',
	reminders_days_weekdays: 'Virkir dagar',
	reminders_days_weekends: 'Helgar',
	add_reminder_title: 'Ný áminning',
	add_reminder_peptide: 'Peptíð',
	add_reminder_pick: 'Veldu peptíð',
	add_reminder_dose: 'Skammtur',
	add_reminder_time: 'Tími',
	add_reminder_days: 'Endurtaka á',
	add_reminder_save: 'Vista áminningu',
	add_reminder_cancel: 'Hætta við',
	add_reminder_close: 'Loka',
	add_reminder_protocol: 'Tímabil (valfrjálst)',
	add_reminder_start_date: 'Hefst',
	add_reminder_duration: 'Lengd',
	add_reminder_forever: 'Áframhaldandi',
	add_reminder_custom: 'Eigin dagsetning',
	add_reminder_end_date: 'Lýkur',
	weeks_label: 'vikur',
	reminder_protocol_finished: 'Lokið',
	reminder_protocol_one_day_left: '1 dagur eftir',
	reminder_protocol_days_left: '{n} dagar eftir',
	reminder_protocol_weeks_left: '{n} vikur eftir',
	log_dose_date: 'Dagsetning',
	log_dose_time: 'Tími',
	tracking_day_empty: 'Engar skammtar þennan dag.',
	day_short_sun: 'Su',
	day_short_mon: 'Má',
	day_short_tue: 'Þr',
	day_short_wed: 'Mi',
	day_short_thu: 'Fi',
	day_short_fri: 'Fö',
	day_short_sat: 'La',

	tracking_empty: 'Engir skammtar skráðir ennþá. Smelltu á „Skrá skammt“.',
	tracking_needs_vials: 'Skráðu fyrst glas undir Mín glös — skammtar eru skráðir á það sem þú átt.',
	tracking_log_dose: 'Skrá skammt',
	tracking_stat_streak: 'Daga í röð',
	tracking_stat_month: 'Þessi mánuður',
	tracking_stat_top: 'Mest tekið',
	tracking_heatmap_title: 'Síðustu 5 vikur',
	tracking_recent_title: 'Nýleg skráning',
	log_dose_title: 'Skrá skammt',
	log_dose_edit: 'Breyta skammti',
	log_dose_vial: 'Úr hvaða glasi',
	log_dose_syringe: 'Sprauta',
	log_dose_units: 'Einingar dregnar',
	log_dose_draw: (mcg, ml) => `= ${mcg} · ${ml} mL`,
	log_dose_no_mixed: 'Blandaðu fyrst glas undir Mín glös — skammtar eru dregnir úr blönduðu glasi.',
	tracking_units: 'einingar',
	unit_mcg: 'mcg',
	unit_mg: 'mg',
	log_dose_peptide: 'Peptíð',
	log_dose_amount: 'Magn',
	log_dose_notes: 'Athugasemd (valfrjáls)',
	log_dose_save: 'Skrá',
	log_dose_today: 'Í dag',
	log_dose_yesterday: 'Í gær',

	onboarding_lang_choose: 'Veldu tungumál · Choose your language',
	onboarding_welcome_title: 'Velkomin í Peptora',
	onboarding_welcome_body:
		'Vasahandbókin þín fyrir peptíð — skammtareiknivél, stacks, áminningar. Allt helst á þessu tæki.',
	onboarding_get_started: 'Byrja',
	onboarding_experience_title: 'Hver er reynsla þín?',
	onboarding_experience_hint: 'Við aðlögum leiðbeiningar eftir því.',
	onboarding_experience_beginner_label: 'Byrjandi',
	onboarding_experience_beginner_hint: 'Nýr í peptíðum — sýndu mér grunninn.',
	onboarding_experience_standard_label: 'Staðall',
	onboarding_experience_standard_hint: 'Smá reynsla af skammtaáætlunum.',
	onboarding_experience_advanced_label: 'Lengra kominn',
	onboarding_experience_advanced_hint: 'Vanur að stacka og stilla skammta.',
	onboarding_gender_title: 'Hvernig skilgreinir þú þig?',
	onboarding_gender_hint:
		'Sum peptíð hafa kynbundnar skammtaleiðbeiningar — þetta hjálpar okkur að sýna það sem skiptir þig máli.',
	onboarding_gender_male: 'Karl',
	onboarding_gender_female: 'Kona',
	onboarding_gender_other: 'Annað',
	onboarding_disclaimer_title: 'Áður en þú byrjar',
	onboarding_disclaimer_body_1:
		'Peptora er aðeins til fræðslunotkunar. Mörg peptíð sem fjallað er um eru rannsóknarefni sem ekki eru samþykkt af FDA eða öðrum regluvörðum til notkunar í mönnum.',
	onboarding_disclaimer_body_2:
		'Ekkert hér er læknisráð. Ráðfærðu þig alltaf við hæfan heilbrigðisstarfsmann áður en þú byrjar, breytir eða hættir protocol.',
	onboarding_disclaimer_body_3:
		'Með því að halda áfram samþykkir þú að bera fulla ábyrgð á ákvörðunum sem þú tekur byggt á upplýsingum í þessu appi.',
	onboarding_disclaimer_action: 'Ég skil',
	onboarding_email_title: 'Fylgstu með',
	onboarding_email_body:
		'Fáðu stöku uppfærslur um ný peptíð, skammtaáætlanir og vottaðar heimildir. Engin spamm, hægt að afskrá hvenær sem er. Algjörlega valfrjálst.',
	onboarding_email_placeholder: 'netfang@example.com',
	onboarding_email_subscribe: 'Skrá og halda áfram',
	onboarding_email_subscribing: 'Skrái…',
	onboarding_email_skip: 'Sleppa í bili',
	onboarding_back: 'Til baka',
	install_banner_title: 'Settu á heimaskjáinn',
	install_banner_body: 'Peptora er hannað fyrir símann þinn. Settu það upp fyrir fullan skjá og offline aðgang.',
	install_banner_cta: 'Sjá hvernig',
	install_banner_dismiss: 'Loka',

	settings_title: 'Stillingar',
	settings_section_profile: 'Prófíll',
	settings_section_appearance: 'Útlit',
	settings_section_language: 'Tungumál',
	settings_section_safety: 'Öryggi',
	settings_section_notifications: 'Tilkynningar',
	settings_notifications_label: 'Áminningar og fréttir',
	settings_notifications_hint:
		'Fáðu tilkynningu í símann þegar áminning kemur eða ný grein birtist.',
	settings_notifications_enable: 'Kveikja á tilkynningum',
	settings_notifications_disable: 'Slökkva',
	settings_notifications_pending: 'Set upp…',
	settings_notifications_unsupported:
		'Vafrinn þinn styður ekki web push tilkynningar.',
	settings_notifications_denied:
		'Þú lokaðir á tilkynningar. Opnaðu site settings í vafranum til að virkja aftur.',
	settings_notifications_needs_install:
		'Á iPhone þarftu fyrst að setja Peptora á heimaskjáinn — tilkynningar virka eingöngu í installed mode.',
	settings_notifications_error: 'Náði ekki að virkja. Reyndu aftur.',
	settings_section_newsletter: 'Fréttabréf',
	settings_section_data: 'Gögnin þín',
	settings_section_about: 'Um',
	settings_experience_label: 'Reynslustig',
	settings_gender_label: 'Kyn',
	settings_theme_label: 'Þema',
	settings_theme_light: 'Ljóst',
	settings_theme_dark: 'Dökkt',
	settings_theme_system: 'Kerfi',
	settings_theme_hint: 'Kerfi fylgir stillingu símans og skiptir sjálfkrafa.',
	settings_language_label: 'Tungumál appsins',
	settings_language_hint: 'Skiptir UI strax. Peptíð-innihald skiptir líka.',
	settings_warnings_label: 'Sýna öryggisviðvaranir',
	settings_warnings_hint: 'Birta disclaimer á skjáum tengdum skömmtum.',
	settings_newsletter_label: 'Uppfærslur frá Peptora',
	settings_newsletter_hint:
		'Stöku tölvupóstar um ný peptíð, skammtaáætlanir og vottaðar heimildir. Afskráning hvenær sem er.',
	settings_newsletter_subscribed: 'Þú ert komin/n á listann. Takk!',
	settings_newsletter_subscribing: 'Skrái…',
	settings_newsletter_subscribe: 'Skrá',
	settings_data_summary:
		'Allt sem Peptora veit um þig — eigin stacks, skammtasaga, áminningar, stillingar — býr aðeins á þessu tæki. Engin sky, engin innskráning.',
	settings_clear_all: 'Eyða öllum gögnum',
	settings_clear_confirm:
		'Eyða öllum áminningum, skammtasögu, eigin stacks og stillingum? Þetta er ekki hægt að taka til baka.',
	settings_about_version: 'Útgáfa',
	settings_about_build: 'Bygging',
	settings_about_disclaimer:
		'Peptora er aðeins til fræðslunotkunar. Mörg peptíð eru rannsóknarefni og ekki FDA-samþykkt. Ráðfærðu þig alltaf við hæfan heilbrigðisstarfsmann áður en þú byrjar, breytir eða hættir protocol.',
	settings_about_website: 'peptora.app',
	settings_about_privacy: 'Persónuverndarstefna',
	settings_experience_beginner: 'Byrjandi',
	settings_experience_standard: 'Staðall',
	settings_experience_advanced: 'Lengra kominn',
	settings_gender_male: 'Karl',
	settings_gender_female: 'Kona',
	settings_gender_other: 'Annað',

	news_title: 'Fréttir',
	news_subtitle: 'Nýjar rannsóknir og athugasemdir um peptíða-skammtaáætlanir.',
	news_empty_title: 'Engar greinar enn',
	news_empty_subtitle: 'Líttu við seinna — ferskt efni kemur reglulega.',
	news_error_title: 'Næ ekki í greinar',
	news_error_subtitle: 'Athugaðu nettenginguna og reyndu aftur.',
	news_retry: 'Reyna aftur',
	news_read_more: 'Lesa á peptora.app',
	news_category_research: 'Rannsóknir',
	news_category_protocol: 'Skammtaáætlun',
	news_category_product: 'Vara',
	news_category_industry: 'Fréttir',

	error_generic: 'Eitthvað fór úrskeiðis.',
	loading: 'Sæki…'
};

export const strings: Record<Locale, UIStrings> = { en, is };

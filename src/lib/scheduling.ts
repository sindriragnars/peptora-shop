/**
 * Dose-schedule inference. Maps the free-text `frequency` field in
 * the peptide database (e.g. "2x per day (morning + evening)", "1x
 * per week") to concrete (times-of-day, days-of-week) pairs we can
 * use for two things:
 *
 *   1. Drawing dots on the 24-hour timeline in the stack detail UI.
 *   2. Creating starter Reminder rows when the user taps "Start
 *      this stack".
 *
 * Intentionally a best-effort heuristic — the source strings aren't
 * a controlled vocabulary, so we cover the common cases and fall
 * back to a sensible evening default. Users can edit the resulting
 * reminders on /doses if the inferred time isn't what they want.
 */

export interface InferredSchedule {
	/** "HH:MM" 24-hour times the dose fires. */
	times: string[];
	/** Days-of-week (0 = Sun … 6 = Sat). [0..6] = daily. */
	days: number[];
}

const DAILY = [0, 1, 2, 3, 4, 5, 6];

export function inferSchedule(frequency: string): InferredSchedule {
	const f = frequency.toLowerCase();

	// Weekly cadences — pick representative days, single evening time.
	if (f.includes('per week') || f.includes('weekly')) {
		if (/^3x|3-?5x/.test(f)) return { times: ['20:00'], days: [1, 3, 5] }; // Mon/Wed/Fri
		if (/^2x/.test(f)) return { times: ['20:00'], days: [1, 4] }; // Mon/Thu
		return { times: ['20:00'], days: [0] }; // 1x → Sunday
	}

	// On-demand or PRN — a single midday placeholder, daily.
	if (f.includes('on-demand') || f.includes('on demand')) {
		return { times: ['14:00'], days: DAILY };
	}

	// Per-day cadences, time-of-day hints first.
	if (f.includes('before sleep')) {
		return { times: ['22:00'], days: DAILY };
	}
	if ((f.includes('morning') && f.includes('evening')) || /am\s*\+\s*pm/.test(f)) {
		return { times: ['08:00', '20:00'], days: DAILY };
	}
	if (/3x.*day|morning.*workout.*evening/.test(f)) {
		return { times: ['08:00', '14:00', '20:00'], days: DAILY };
	}
	if (/2-?3x.*day/.test(f)) {
		return { times: ['08:00', '14:00', '20:00'], days: DAILY };
	}
	if (/1-?2x.*day|2x.*day/.test(f)) {
		return { times: ['08:00', '20:00'], days: DAILY };
	}
	if (f.includes('in the morning') || f.includes('am ')) {
		return { times: ['08:00'], days: DAILY };
	}
	if (/1x.*day/.test(f)) {
		return { times: ['20:00'], days: DAILY };
	}

	// Catch-all — evening, daily. Better to over-remind than miss.
	return { times: ['20:00'], days: DAILY };
}

/** Convert "HH:MM" to a percentage (0–100) of a 24-hour day. */
export function timeToPercent(time: string): number {
	const [h, m] = time.split(':').map(Number);
	return ((h + m / 60) / 24) * 100;
}

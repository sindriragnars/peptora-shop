/**
 * Web Push client wiring. Talks to the peptora-push backend
 * (Vercel + Upstash) — register/unregister the browser's
 * PushSubscription against a server-side ID stored in localStorage.
 *
 * Phase A — basic enable / disable. Phase B (reminders) will add
 * a syncReminders() that POSTs the user's reminder list whenever
 * /doses changes. Phase C (news) is fully server-side; nothing to
 * do client-side.
 */

// Dynamic public env so the build doesn't fail when env.PUBLIC_VAPID_KEY /
// env.PUBLIC_PUSH_API_URL aren't set (push is opt-in; missing vars => push
// is just disabled, not a hard failure). Originally `$env/static/public`
// in peptora-webapp, but that's a build-time hard requirement.
import { env } from '$env/dynamic/public';

const SUB_ID_KEY = 'peptora.pushSubId';

/** True when both env vars are set — the toggle is hidden otherwise. */
export function isPushConfigured(): boolean {
	return !!env.PUBLIC_VAPID_KEY && !!env.PUBLIC_PUSH_API_URL;
}

/** True when the browser exposes the required APIs (SW + Notification + PushManager). */
export function isPushSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Current Notification permission, or 'unsupported' if unavailable. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
	if (!isPushSupported()) return 'unsupported';
	return Notification.permission;
}

export function getStoredSubId(): string | null {
	if (typeof window === 'undefined') return null;
	return window.localStorage.getItem(SUB_ID_KEY);
}

/**
 * Ask permission, subscribe to push, and register the subscription
 * with the backend. Returns the server-side sub ID. Throws on
 * permission-denied or backend errors so the caller can surface a
 * useful error in the Settings UI.
 */
export async function enablePush(): Promise<string> {
	if (!isPushSupported()) throw new Error('push_unsupported');
	if (!isPushConfigured()) throw new Error('push_not_configured');

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') throw new Error('permission_denied');

	const registration = await navigator.serviceWorker.ready;
	// Reuse an existing subscription if present — avoids duplicating
	// rows server-side when the user toggles off and back on.
	let sub = await registration.pushManager.getSubscription();
	if (!sub) {
		sub = await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(env.PUBLIC_VAPID_KEY)
		});
	}

	const res = await fetch(`${env.PUBLIC_PUSH_API_URL}/api/subscribe`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ subscription: sub.toJSON() })
	});
	if (!res.ok) {
		// Roll back the local subscription so we don't end up with a
		// PushSubscription the backend never heard about.
		await sub.unsubscribe().catch(() => {});
		throw new Error(`subscribe_failed_${res.status}`);
	}
	const body = (await res.json()) as { id?: string };
	if (!body.id) throw new Error('subscribe_no_id');

	window.localStorage.setItem(SUB_ID_KEY, body.id);
	return body.id;
}

/**
 * Best-effort tear-down — unsubscribe locally, tell the backend,
 * clear the stored ID. Always succeeds from the caller's POV;
 * partial failures get logged but don't bubble up.
 */
export async function disablePush(): Promise<void> {
	const id = getStoredSubId();

	if (isPushSupported()) {
		try {
			const registration = await navigator.serviceWorker.ready;
			const sub = await registration.pushManager.getSubscription();
			if (sub) await sub.unsubscribe();
		} catch (e) {
			console.warn('local unsubscribe failed', e);
		}
	}

	if (id && isPushConfigured()) {
		try {
			await fetch(`${env.PUBLIC_PUSH_API_URL}/api/unsubscribe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id })
			});
		} catch (e) {
			console.warn('backend unsubscribe failed', e);
		}
	}

	if (typeof window !== 'undefined') {
		window.localStorage.removeItem(SUB_ID_KEY);
	}
}

/** Convert the URL-safe base64 VAPID key into the Uint8Array PushManager needs. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const out = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

/**
 * Minimal service worker. Two jobs:
 *
 * 1. Unlock Chrome / Edge full PWA installability. Browsers gate the
 *    "Install app" prompt on the presence of a registered SW with a
 *    fetch handler — without it visitors only get "Add to Home Screen"
 *    (a glorified bookmark).
 *
 * 2. Light precache of the SvelteKit build + static assets so the
 *    install gives a faster cold-load. We do NOT try to serve full
 *    offline: peptide pages render per-tenant via SSR and we'd rather
 *    show a fresh 200 from network than a stale cached version. So
 *    the fetch handler is network-first with a cache fallback only
 *    for the precached set.
 *
 * Each tenant subdomain is a separate origin to the browser, so SW
 * scope is naturally per-tenant — no tenant cross-contamination.
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE = `peptora-shop-${version}`;
// Files SvelteKit emits for the build + items in /static.
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(ASSETS))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			// Drop caches from earlier versions.
			for (const key of await caches.keys()) {
				if (key !== CACHE) await caches.delete(key);
			}
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	// Don't try to handle non-GET (POST to /admin, etc.) or cross-origin.
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	// Network-first. Falls back to cache only if the network errors AND
	// the asset was precached — we don't want to serve stale tenant
	// content unless we're actually offline.
	event.respondWith(
		(async () => {
			try {
				const fresh = await fetch(request);
				return fresh;
			} catch {
				const cached = await caches.match(request);
				if (cached) return cached;
				return Response.error();
			}
		})()
	);
});

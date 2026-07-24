import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * SvelteKit config for peptora-shop.
 *
 * We use adapter-node (not adapter-static) because tenant resolution reads
 * the request `Host` header on each request to map `<slug>.peptora.app` →
 * tenant content. Static prerender can't do that. Runs as a node container
 * on Coolify (icelandvision VPS) behind Traefik; the Dockerfile sets
 * PROTOCOL_HEADER/HOST_HEADER so forwarded headers are trusted.
 *
 * Individual product pages could still be prerendered per tenant if traffic
 * justifies the build-time cost — defer until we have real catalog sizes.
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter()
	}
};

export default config;

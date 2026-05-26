import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * SvelteKit config for peptora-shop.
 *
 * We use adapter-vercel (not adapter-static) because tenant resolution reads
 * the request `Host` header on each request to map `<slug>.peptora.app` →
 * tenant content. Static prerender can't do that.
 *
 * Individual product pages could still be prerendered per tenant if traffic
 * justifies the build-time cost — defer until we have real catalog sizes.
 */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			runtime: 'nodejs22.x'
		})
	}
};

export default config;

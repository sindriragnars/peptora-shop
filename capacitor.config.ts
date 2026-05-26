import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config — template values get rewritten by
 * scripts/build-apk.mjs at build time, one APK per tenant. The
 * checked-in values target the `demo` tenant so `npx cap sync` works
 * during dev without first running the build script.
 *
 * Phase 5 architecture: thin native shell that loads the production
 * storefront URL over the network. Cart (IndexedDB) is per-origin in
 * the WebView so it persists across launches; checkout/webhook/admin
 * all need network anyway, so the shell-only approach trades zero
 * offline catalog browsing for zero rebuild on every catalog change.
 */
const config: CapacitorConfig = {
	appId: 'app.peptora.shop.demo',
	appName: 'Demo Heilsa',
	webDir: 'capacitor-webdir',
	server: {
		// Production storefront URL. The build script rewrites this to
		// the tenant's subdomain (or the path-based fallback while
		// subdomains are not yet wired in Vercel).
		url: 'https://peptora-shop.vercel.app/demo',
		// Only allow navigation within the tenant's own storefront +
		// the Revolut hosted checkout. Anything else opens externally
		// in the system browser via the InAppBrowser default.
		allowNavigation: [
			'peptora-shop.vercel.app',
			'*.peptora.app',
			'sandbox-merchant.revolut.com',
			'merchant.revolut.com',
			'checkout.revolut.com'
		],
		androidScheme: 'https'
	},
	android: {
		allowMixedContent: false
	}
};

export default config;

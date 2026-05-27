/**
 * Stripe Checkout helpers — used during the smoke-test phase while
 * Revolut sandbox is blocked. Selected via `PAYMENT_PROVIDER=stripe`
 * env var; default is Revolut.
 *
 * Per-tenant credential convention mirrors Revolut: env var name is
 * derived from the slug (hyphens → underscores, uppercased).
 *
 *   DEMO_STRIPE_SECRET_KEY
 *   DEMO_STRIPE_WEBHOOK_SECRET
 *
 * Server-only. Stripe SDK pulls in Node `crypto` + `https`, which is
 * fine under adapter-vercel's Node runtime.
 *
 * ISK note: Stripe has a backward-compat quirk for ISK — the API still
 * uses minor units, so unit_amount must be `priceISK * 100` and the
 * total must be evenly divisible by 100. We multiply on the way out.
 */
import Stripe from 'stripe';
import type { TenantConfig } from './tenants';
import type { OrderItem } from './orders';

function envName(tenant: TenantConfig, suffix: string): string {
	return `${tenant.slug.replace(/-/g, '_').toUpperCase()}_STRIPE_${suffix}`;
}

function getApiKey(tenant: TenantConfig): string {
	// Tenant-specific key wins. Falls back to platform-wide
	// STRIPE_SECRET_KEY for shared-sandbox setups where every tenant
	// uses the same Stripe account (typical when piloting a new client
	// before they have their own Stripe Connect). Webhook secret stays
	// per-tenant always — each endpoint has its own signing secret.
	const name = envName(tenant, 'SECRET_KEY');
	const tenantKey = process.env[name];
	if (tenantKey) return tenantKey;
	const platformKey = process.env.STRIPE_SECRET_KEY;
	if (platformKey) return platformKey;
	throw new Error(
		`Missing Stripe secret key — set ${name} or platform-wide STRIPE_SECRET_KEY`
	);
}

export function getWebhookSecret(tenant: TenantConfig): string {
	const name = envName(tenant, 'WEBHOOK_SECRET');
	const secret = process.env[name];
	if (!secret) {
		throw new Error(`Missing Stripe webhook secret env var ${name} for tenant ${tenant.slug}`);
	}
	return secret;
}

function stripeClient(tenant: TenantConfig): Stripe {
	// Force the SDK to use native fetch instead of Node's http module —
	// the default Node HTTP client throws StripeConnectionError on
	// Vercel's serverless functions ("Request was retried 2 times").
	// Native fetch is the documented workaround.
	return new Stripe(getApiKey(tenant), {
		httpClient: Stripe.createFetchHttpClient()
	});
}

export interface CreateCheckoutInput {
	tenant: TenantConfig;
	merchantOrderRef: string; // our own orderId, stored as Stripe's client_reference_id
	items: OrderItem[];
	shipping: { option: string; costISK: number };
	customerEmail: string;
	successUrl: string;
	cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session. Returns { id, url } — the
 * client redirects the customer to `url`, Stripe handles card entry
 * + 3DS + capture, then redirects back to successUrl on completion.
 */
export async function createCheckoutSession(input: CreateCheckoutInput): Promise<{
	id: string;
	url: string;
}> {
	const stripe = stripeClient(input.tenant);

	// Build line items: one per product, plus a synthetic shipping line.
	// Bundling shipping as a line item (instead of using Stripe's
	// shipping_options) is the simplest path — the storefront has
	// already computed the per-tenant flat rate.
	// ISK in Stripe: priceISK * 100. See file header for backward-compat
	// rationale.
	const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = input.items.map((item) => ({
		price_data: {
			currency: 'isk',
			product_data: { name: item.title },
			unit_amount: item.priceISK * 100
		},
		quantity: item.qty
	}));
	if (input.shipping.costISK > 0) {
		lineItems.push({
			price_data: {
				currency: 'isk',
				product_data: { name: `Sending (${input.shipping.option})` },
				unit_amount: input.shipping.costISK * 100
			},
			quantity: 1
		});
	}

	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		// Explicit card-only so Stripe doesn't reject the session when
		// the sandbox account hasn't pre-activated ISK-compatible
		// payment methods (auto-detection fails for ISK in some accounts).
		payment_method_types: ['card'],
		line_items: lineItems,
		client_reference_id: input.merchantOrderRef,
		customer_email: input.customerEmail,
		success_url: input.successUrl,
		cancel_url: input.cancelUrl
	});

	if (!session.url) {
		throw new Error('Stripe session created without a checkout URL');
	}
	return { id: session.id, url: session.url };
}

/**
 * Verify + parse an incoming Stripe webhook payload. Throws if the
 * signature is invalid (caller should 401). Returns the parsed event
 * so the caller can dispatch on `event.type`.
 */
export function constructEvent(opts: {
	tenant: TenantConfig;
	rawBody: string;
	signatureHeader: string | null;
}): Stripe.Event {
	if (!opts.signatureHeader) throw new Error('missing stripe-signature header');
	const stripe = stripeClient(opts.tenant);
	return stripe.webhooks.constructEvent(
		opts.rawBody,
		opts.signatureHeader,
		getWebhookSecret(opts.tenant)
	);
}

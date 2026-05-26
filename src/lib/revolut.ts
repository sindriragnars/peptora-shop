/**
 * Revolut Merchant API client.
 *
 * Server-only. Each tenant uses its own Revolut Business account and
 * provides an API key via env var (e.g. ACME_REVOLUT_API_KEY). The
 * tenant config references the env-var NAME so credentials never live
 * in repo content.
 *
 * Docs: https://developer.revolut.com/docs/merchant
 *
 * ISK note: Iceland is EEA but not EU; ISK as merchant settlement
 * currency is an open question that must be verified at first tenant
 * onboarding. If unsupported, fall back to EUR settlement (display ISK
 * on storefront, settle in EUR via on-the-fly conversion). The amount
 * unit handling differs: EUR uses minor units (1234 = €12.34) while
 * ISK has 0 decimals so amount is the ISK whole number. Until
 * confirmed, this client passes `amount` as-is + `currency: 'ISK'` —
 * tweak in implementation phase if Revolut returns "unsupported
 * currency".
 */
import type { TenantConfig } from './tenants';

const REVOLUT_API_BASE = 'https://merchant.revolut.com/api';

export interface CreateOrderInput {
	tenant: TenantConfig;
	/** Total amount in ISK whole units (or minor units for other currencies). */
	amount: number;
	currency: 'ISK' | 'EUR';
	/** Our own order id, used as `merchant_order_ext_ref` for reconciliation. */
	merchantOrderRef: string;
	description: string;
	/** Where Revolut redirects the customer after successful payment. */
	successUrl: string;
	cancelUrl: string;
	customer: {
		email: string;
		name: string;
		phone?: string;
	};
}

export interface RevolutOrder {
	id: string;
	public_id: string;
	type: 'PAYMENT';
	state: 'PENDING' | 'PROCESSING' | 'AUTHORISED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
	checkout_url: string;
	created_date: string;
}

/**
 * Resolve a tenant's Revolut API key from env vars. The key name is
 * stored in tenant config (`revolut.apiKeyRef`) — value lives in the
 * Vercel project as a secret.
 */
function getApiKey(tenant: TenantConfig): string {
	const key = process.env[tenant.revolut.apiKeyRef];
	if (!key) {
		throw new Error(
			`Missing Revolut API key env var ${tenant.revolut.apiKeyRef} for tenant ${tenant.slug}`
		);
	}
	return key;
}

export async function createOrder(input: CreateOrderInput): Promise<RevolutOrder> {
	const apiKey = getApiKey(input.tenant);

	const res = await fetch(`${REVOLUT_API_BASE}/orders`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
			'Revolut-Api-Version': '2024-09-01'
		},
		body: JSON.stringify({
			amount: input.amount,
			currency: input.currency,
			merchant_order_ext_ref: input.merchantOrderRef,
			description: input.description,
			redirect_url: input.successUrl,
			cancel_url: input.cancelUrl,
			customer: {
				email: input.customer.email,
				full_name: input.customer.name,
				phone: input.customer.phone
			}
		})
	});

	if (!res.ok) {
		const errorText = await res.text();
		throw new Error(`Revolut createOrder failed: ${res.status} ${errorText}`);
	}

	return res.json();
}

/**
 * Verify a Revolut webhook signature. Headers from Revolut:
 *   Revolut-Signature: v1=<sha256-hex>,t=<unix-seconds>
 *   Revolut-Request-Timestamp: <unix-seconds>
 *
 * Signed payload = `v1.<timestamp>.<rawBody>` HMAC-SHA256 with the
 * webhook secret. We reject signatures older than 5 minutes to limit
 * replay attacks.
 *
 * Returns true if signature valid, false otherwise. Caller should 401
 * on false.
 */
export async function verifyWebhookSignature(opts: {
	rawBody: string;
	signatureHeader: string | null;
	timestampHeader: string | null;
	webhookSecret: string;
	maxAgeSeconds?: number;
}): Promise<boolean> {
	const { rawBody, signatureHeader, timestampHeader, webhookSecret } = opts;
	const maxAgeSeconds = opts.maxAgeSeconds ?? 5 * 60;

	if (!signatureHeader || !timestampHeader) return false;

	// Replay-protection: timestamp must be recent.
	const ts = parseInt(timestampHeader, 10);
	if (Number.isNaN(ts)) return false;
	const ageSec = Math.floor(Date.now() / 1000) - ts;
	if (ageSec < 0 || ageSec > maxAgeSeconds) return false;

	// Extract v1=<hex> from comma-separated signature header.
	const v1Match = signatureHeader.match(/v1=([0-9a-f]+)/i);
	if (!v1Match) return false;
	const providedSig = v1Match[1].toLowerCase();

	// Compute HMAC-SHA256(secret, "v1." + timestamp + "." + rawBody).
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		encoder.encode(webhookSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sigBytes = await crypto.subtle.sign(
		'HMAC',
		key,
		encoder.encode(`v1.${timestampHeader}.${rawBody}`)
	);
	const computedSig = Array.from(new Uint8Array(sigBytes))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	// Constant-time compare so we don't leak validity timing.
	if (computedSig.length !== providedSig.length) return false;
	let mismatch = 0;
	for (let i = 0; i < computedSig.length; i++) {
		mismatch |= computedSig.charCodeAt(i) ^ providedSig.charCodeAt(i);
	}
	return mismatch === 0;
}

/**
 * Resolve a tenant's webhook secret from env vars. Same pattern as the
 * API key — the env-var NAME lives in tenant config, the secret value
 * lives in Vercel.
 */
export function getWebhookSecret(tenant: TenantConfig): string {
	const secret = process.env[tenant.revolut.webhookSecretRef];
	if (!secret) {
		throw new Error(
			`Missing Revolut webhook secret env var ${tenant.revolut.webhookSecretRef} for tenant ${tenant.slug}`
		);
	}
	return secret;
}

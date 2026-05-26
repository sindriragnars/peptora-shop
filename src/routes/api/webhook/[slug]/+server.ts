import { json } from '@sveltejs/kit';
import { getTenant } from '$lib/tenants';
import {
	findByRevolutOrderId,
	updateOrder,
	type OrderStatus
} from '$lib/orders';
import {
	sendOrderConfirmationToCustomer,
	sendOrderNotificationToAdmin
} from '$lib/email';
import { verifyWebhookSignature, getWebhookSecret } from '$lib/revolut';
import type { RequestHandler } from './$types';

/**
 * Revolut webhook receiver, scoped per tenant via URL slug.
 *
 * Production webhook URL configured in each tenant's Revolut Business
 * portal: https://peptora-shop.vercel.app/api/webhook/<slug>
 *
 * The slug in the URL is the only routing key — signature verification
 * uses the per-tenant secret resolved via tenant config. Wrong slug or
 * wrong signature returns 401 without leaking anything about other
 * tenants.
 *
 * Always returns 200 to acknowledge receipt once signature is valid, so
 * Revolut doesn't keep retrying. Internal processing failures are logged
 * but don't surface — the order is already paid on Revolut's side; we
 * can reconcile manually if anything got dropped.
 */

const RELEVANT_EVENTS = new Set([
	'ORDER_COMPLETED',
	'ORDER_AUTHORISED',
	'ORDER_FAILED',
	'ORDER_CANCELLED'
]);

export const POST: RequestHandler = async ({ params, request }) => {
	const tenant = getTenant(params.slug);
	if (!tenant) return json({ error: 'tenant not found' }, { status: 404 });

	// Raw body — signature is computed over bytes-as-sent, so we must
	// read once and not re-parse via SvelteKit's JSON helper.
	const rawBody = await request.text();

	let secret: string;
	try {
		secret = getWebhookSecret(tenant);
	} catch {
		// Mis-configured tenant. Return 401 so Revolut treats it as an
		// auth failure (will retry, giving us a chance to add the env var).
		return json({ error: 'webhook not configured' }, { status: 401 });
	}

	const valid = await verifyWebhookSignature({
		rawBody,
		signatureHeader: request.headers.get('Revolut-Signature'),
		timestampHeader: request.headers.get('Revolut-Request-Timestamp'),
		webhookSecret: secret
	});
	if (!valid) {
		return json({ error: 'invalid signature' }, { status: 401 });
	}

	// Parse + dispatch.
	let event: { event?: string; order_id?: string };
	try {
		event = JSON.parse(rawBody);
	} catch {
		return json({ error: 'invalid JSON' }, { status: 400 });
	}

	if (!event.event || !event.order_id) {
		return json({ ok: true, ignored: 'missing fields' });
	}
	if (!RELEVANT_EVENTS.has(event.event)) {
		return json({ ok: true, ignored: event.event });
	}

	const order = await findByRevolutOrderId(tenant.slug, event.order_id);
	if (!order) {
		// Either Revolut sent a webhook for a different platform's order
		// (shouldn't happen — they're scoped per-key) or our Redis lost
		// the record. Log loud + return 200 so we don't loop on retries.
		console.warn('webhook for unknown order', {
			tenant: tenant.slug,
			revolutOrderId: event.order_id
		});
		return json({ ok: true, ignored: 'unknown order' });
	}

	const newStatus: OrderStatus | null =
		event.event === 'ORDER_COMPLETED'
			? 'paid'
			: event.event === 'ORDER_AUTHORISED'
				? 'paid'
				: event.event === 'ORDER_FAILED'
					? 'failed'
					: event.event === 'ORDER_CANCELLED'
						? 'cancelled'
						: null;

	if (!newStatus || newStatus === order.status) {
		// Nothing changed — Revolut sometimes redelivers the same event.
		return json({ ok: true, idempotent: true });
	}

	const patch: Partial<typeof order> = { status: newStatus };
	if (newStatus === 'paid') patch.paidAt = Date.now();
	const updated = await updateOrder(order.id, patch);

	if (updated && newStatus === 'paid') {
		// Best-effort emails — failures inside email helpers log but
		// don't throw, so this can't drop the 200 response.
		await Promise.all([
			sendOrderConfirmationToCustomer({ order: updated, tenant }),
			sendOrderNotificationToAdmin({ order: updated, tenant })
		]);
	}

	return json({ ok: true });
};

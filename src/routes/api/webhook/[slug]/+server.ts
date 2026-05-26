import { json } from '@sveltejs/kit';
import { getTenant } from '$lib/tenants';
import {
	findByRevolutOrderId,
	getOrder,
	updateOrder,
	type OrderStatus
} from '$lib/orders';
import {
	sendOrderConfirmationToCustomer,
	sendOrderNotificationToAdmin
} from '$lib/email';
import { verifyWebhookSignature, getWebhookSecret } from '$lib/revolut';
import { constructEvent as constructStripeEvent } from '$lib/stripe';
import type { RequestHandler } from './$types';

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? 'revolut';

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

	// Resolve (orderId, newStatus) from the provider-specific payload +
	// signature verification. Returning null = ignore (idempotent
	// redelivery, wrong event type, missing fields, etc.). Throwing =
	// invalid signature / misconfigured tenant.
	let resolved: { orderId: string; newStatus: OrderStatus } | null;
	try {
		resolved =
			PAYMENT_PROVIDER === 'stripe'
				? await handleStripeWebhook(tenant, rawBody, request.headers.get('stripe-signature'))
				: await handleRevolutWebhook(tenant, rawBody, request.headers);
	} catch (e) {
		console.warn('webhook rejected', { tenant: tenant.slug, error: String(e) });
		return json({ error: 'invalid signature or config' }, { status: 401 });
	}

	if (!resolved) return json({ ok: true, ignored: true });

	const order = await getOrder(resolved.orderId);
	if (!order || order.tenantSlug !== tenant.slug) {
		console.warn('webhook for unknown order', {
			tenant: tenant.slug,
			orderId: resolved.orderId
		});
		return json({ ok: true, ignored: 'unknown order' });
	}
	if (order.status === resolved.newStatus) {
		// Already at this status — redelivery or out-of-order event.
		return json({ ok: true, idempotent: true });
	}

	const patch: Partial<typeof order> = { status: resolved.newStatus };
	if (resolved.newStatus === 'paid') patch.paidAt = Date.now();
	const updated = await updateOrder(order.id, patch);

	if (updated && resolved.newStatus === 'paid') {
		// Best-effort emails — failures inside email helpers log but
		// don't throw, so this can't drop the 200 response.
		await Promise.all([
			sendOrderConfirmationToCustomer({ order: updated, tenant }),
			sendOrderNotificationToAdmin({ order: updated, tenant })
		]);
	}

	return json({ ok: true });
};

async function handleRevolutWebhook(
	tenant: ReturnType<typeof getTenant> & object,
	rawBody: string,
	headers: Headers
): Promise<{ orderId: string; newStatus: OrderStatus } | null> {
	const secret = getWebhookSecret(tenant);
	const valid = await verifyWebhookSignature({
		rawBody,
		signatureHeader: headers.get('Revolut-Signature'),
		timestampHeader: headers.get('Revolut-Request-Timestamp'),
		webhookSecret: secret
	});
	if (!valid) throw new Error('invalid signature');

	const event = JSON.parse(rawBody) as { event?: string; order_id?: string };
	if (!event.event || !event.order_id) return null;
	if (!RELEVANT_EVENTS.has(event.event)) return null;

	const order = await findByRevolutOrderId(tenant.slug, event.order_id);
	if (!order) return null;

	const newStatus: OrderStatus | null =
		event.event === 'ORDER_COMPLETED' || event.event === 'ORDER_AUTHORISED'
			? 'paid'
			: event.event === 'ORDER_FAILED'
				? 'failed'
				: event.event === 'ORDER_CANCELLED'
					? 'cancelled'
					: null;
	return newStatus ? { orderId: order.id, newStatus } : null;
}

async function handleStripeWebhook(
	tenant: ReturnType<typeof getTenant> & object,
	rawBody: string,
	signatureHeader: string | null
): Promise<{ orderId: string; newStatus: OrderStatus } | null> {
	const event = constructStripeEvent({ tenant, rawBody, signatureHeader });
	if (event.type !== 'checkout.session.completed') return null;
	const session = event.data.object as { client_reference_id?: string | null };
	const orderId = session.client_reference_id;
	if (!orderId) return null;
	return { orderId, newStatus: 'paid' };
}

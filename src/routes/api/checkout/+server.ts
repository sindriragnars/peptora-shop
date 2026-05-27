import { error, json } from '@sveltejs/kit';
import { getTenant } from '$lib/tenants';
import { getProduct } from '$lib/products.server';
import { createOrder as createRevolutOrder } from '$lib/revolut';
import { createCheckoutSession as createStripeSession } from '$lib/stripe';
import { saveOrder, type Order, type OrderItem } from '$lib/orders';
import type { RequestHandler } from './$types';

const PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? 'revolut';

/**
 * Checkout endpoint. Client POSTs cart contents + customer details +
 * shipping option; we resolve everything server-side (don't trust
 * client prices), call Revolut to create an order, persist our own
 * record, and return the Revolut hosted checkout URL for the client to
 * redirect to.
 *
 * Auth: no auth — guest checkout. We rate-limit by IP at the platform
 * level (Vercel firewall) rather than per-route.
 */

interface CheckoutRequest {
	tenantSlug: string;
	items: Array<{ productId: string; qty: number }>;
	customer: {
		name: string;
		email: string;
		phone: string;
		address: string;
		postalCode: string;
		city: string;
		notes?: string;
	};
	shippingOption: string;
}

export const POST: RequestHandler = async ({ request, url }) => {
	const body = (await request.json()) as Partial<CheckoutRequest>;

	// Basic validation — fail fast on missing fields so we don't burn
	// a Revolut API call on a malformed request.
	if (!body.tenantSlug) error(400, 'tenantSlug required');
	if (!Array.isArray(body.items) || body.items.length === 0) error(400, 'items required');
	if (!body.customer?.email || !body.customer?.name) error(400, 'customer email + name required');
	if (!body.shippingOption) error(400, 'shippingOption required');

	const tenant = getTenant(body.tenantSlug);
	if (!tenant) error(404, 'tenant not found');

	// Resolve products + snapshot prices. Reject if any product has
	// disappeared from the catalog or is out of stock — saves us
	// processing a payment for an unfulfillable order.
	const items: OrderItem[] = [];
	let subtotalISK = 0;
	for (const line of body.items) {
		const product = getProduct(tenant.slug, line.productId);
		if (!product) error(400, `product ${line.productId} not found`);
		if (product.stock === 'out') error(400, `product ${line.productId} is out of stock`);
		const qty = Math.max(1, Math.floor(line.qty));
		const lineTotalISK = product.priceISK * qty;
		items.push({
			productId: product.id,
			title: product.title,
			priceISK: product.priceISK,
			qty,
			lineTotalISK
		});
		subtotalISK += lineTotalISK;
	}

	// Validate the shipping option came from the tenant's configured list.
	if (!tenant.shipping.options.includes(body.shippingOption)) {
		error(400, 'invalid shippingOption');
	}
	const costISK =
		subtotalISK >= tenant.shipping.freeAboveISK ? 0 : tenant.shipping.flatRateISK;
	const totalISK = subtotalISK + costISK;

	// Our own order id. Used as Revolut's merchant_order_ext_ref so the
	// webhook can reconcile back to us.
	const orderId = crypto.randomUUID();

	// Build the Order record now (status: pending). We save BEFORE
	// calling Revolut so even if Revolut errors mid-flight we have a
	// record to investigate.
	const order: Order = {
		id: orderId,
		tenantSlug: tenant.slug,
		status: 'pending',
		customer: { ...(body.customer as Required<CheckoutRequest['customer']>) },
		items,
		shipping: { option: body.shippingOption, costISK },
		subtotalISK,
		totalISK,
		currency: 'ISK',
		// Filled after Revolut call. Placeholders satisfy the type;
		// they get overwritten before save.
		revolut: { orderId: '', publicId: '', checkoutUrl: '' },
		createdAt: Date.now()
	};

	// Hand off to the payment provider for a hosted checkout URL.
	const successUrl = `${url.origin}/${tenant.slug}/checkout/success?orderId=${orderId}`;
	const cancelUrl = `${url.origin}/${tenant.slug}/checkout/cancelled?orderId=${orderId}`;

	try {
		if (PAYMENT_PROVIDER === 'stripe') {
			const session = await createStripeSession({
				tenant,
				merchantOrderRef: orderId,
				items,
				shipping: { option: body.shippingOption, costISK },
				customerEmail: order.customer.email,
				successUrl,
				cancelUrl
			});
			// Reuse the `revolut` field as the generic payment-provider
			// reference during smoke testing. Renaming to `payment.*` is a
			// follow-up once we settle on a provider for production.
			order.revolut = { orderId: session.id, publicId: '', checkoutUrl: session.url };
		} else {
			const revolutOrder = await createRevolutOrder({
				tenant,
				amount: totalISK,
				currency: 'ISK',
				merchantOrderRef: orderId,
				description: `${tenant.name} — ${items.length} ${items.length === 1 ? 'vara' : 'vörur'}`,
				successUrl,
				cancelUrl,
				customer: {
					email: order.customer.email,
					name: order.customer.name,
					phone: order.customer.phone
				}
			});
			order.revolut = {
				orderId: revolutOrder.id,
				publicId: revolutOrder.public_id,
				checkoutUrl: revolutOrder.checkout_url
			};
		}
	} catch (e) {
		const err = e as { message?: string; type?: string; code?: string };
		console.error(
			`${PAYMENT_PROVIDER} createOrder failed orderId=${orderId} type=${err?.type} code=${err?.code} :: ${err?.message}`
		);
		error(502, 'Payment provider unavailable. Try again in a moment.');
	}

	await saveOrder(order);

	return json({
		orderId,
		checkoutUrl: order.revolut.checkoutUrl
	});
};

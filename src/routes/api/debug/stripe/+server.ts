/**
 * SMOKE TEST debug endpoint. Lightweight Stripe call to disentangle
 * "is it the SDK?", "is it the key?", "is it the network?". Delete
 * once the smoke test is done.
 */
import Stripe from 'stripe';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const slug = (url.searchParams.get('slug') ?? 'demo').toUpperCase().replace(/-/g, '_');
	const envName = `${slug}_STRIPE_SECRET_KEY`;
	const key = process.env[envName];
	if (!key) return json({ error: `no env var ${envName}` }, { status: 500 });

	const diagnostic: Record<string, unknown> = {
		envName,
		keyLength: key.length,
		keyPrefix: key.substring(0, 8),
		keyHasWhitespace: /\s/.test(key)
	};

	// Try raw fetch first to isolate SDK from network
	try {
		const rawRes = await fetch('https://api.stripe.com/v1/balance', {
			headers: { Authorization: `Bearer ${key}` }
		});
		diagnostic.rawFetchStatus = rawRes.status;
		diagnostic.rawFetchBody = (await rawRes.text()).substring(0, 200);
	} catch (e) {
		diagnostic.rawFetchError = String(e);
	}

	// Then try via SDK with fetch client
	try {
		const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
		const balance = await stripe.balance.retrieve();
		diagnostic.sdkOk = true;
		diagnostic.sdkAvailable = balance.available.length;
	} catch (e) {
		const err = e as { message?: string; type?: string; code?: string };
		diagnostic.sdkError = err?.message;
		diagnostic.sdkType = err?.type;
		diagnostic.sdkCode = err?.code;
	}

	return json(diagnostic);
};

/**
 * Signup application store (Redis-backed).
 *
 * Public visitors apply at /sell. Applications go into a pending queue
 * that the platform admin reviews at /admin/signups. Approval is
 * recorded here, but actually materializing the tenant (creating
 * content/tenants/<slug>/tenant.json + Decap collection) is still
 * manual via the existing git workflow in MVP. Auto-create comes in
 * Phase 7.5 when the volume justifies the GitHub API plumbing.
 *
 * Redis keys:
 *   shop:signup:<id>   → JSON-serialised SignupApplication
 *   shop:signups       → sorted set of signup ids, scored by createdAt
 *
 * Applications are kept long-term (1-year TTL on per-key entries,
 * sorted set has no expiry — pruned manually if it grows).
 */
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const SIGNUP_KEY = (id: string) => `shop:signup:${id}`;
const ALL_SIGNUPS_ZSET = 'shop:signups';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export type SignupStatus = 'pending' | 'approved' | 'rejected';

export interface SignupApplication {
	id: string;
	status: SignupStatus;
	/** Requested tenant slug. URL-safe, validated unique at create time. */
	slug: string;
	/** Display name of the shop, e.g. "Palli's Verslun". */
	name: string;
	/** Applicant's name (the owner). */
	ownerName: string;
	/** Applicant email — gmail is fine. */
	email: string;
	phone?: string;
	address?: string;
	/** Brand colour as hex string, e.g. "#0e7c66". */
	brandColor: string;
	flatRateISK: number;
	freeShippingISK: number;
	/** Free-text "what do you want to sell?" — helps admin vet for spam + intent. */
	description: string;
	createdAt: number;
	processedAt?: number;
	rejectReason?: string;
}

export type SignupCreateInput = Omit<
	SignupApplication,
	'id' | 'status' | 'createdAt' | 'processedAt' | 'rejectReason'
>;

/** Create + persist a new pending application. Returns the new id. */
export async function createSignup(input: SignupCreateInput): Promise<string> {
	const id = crypto.randomUUID();
	const app: SignupApplication = {
		id,
		status: 'pending',
		createdAt: Date.now(),
		...input
	};
	await redis.set(SIGNUP_KEY(id), JSON.stringify(app), { ex: ONE_YEAR_SECONDS });
	await redis.zadd(ALL_SIGNUPS_ZSET, { score: app.createdAt, member: id });
	return id;
}

export async function getSignup(id: string): Promise<SignupApplication | null> {
	const raw = await redis.get(SIGNUP_KEY(id));
	if (!raw) return null;
	return typeof raw === 'string' ? (JSON.parse(raw) as SignupApplication) : (raw as SignupApplication);
}

/**
 * List signups, newest first. Filtered in-memory (small dataset
 * expected). If we ever pass ~hundreds of applications we'll switch
 * to per-status sorted sets.
 */
export async function listSignups(filter?: { status?: SignupStatus }): Promise<SignupApplication[]> {
	const ids = (await redis.zrange<string[]>(ALL_SIGNUPS_ZSET, 0, -1, { rev: true })) ?? [];
	if (ids.length === 0) return [];
	const keys = ids.map(SIGNUP_KEY);
	const raws = await redis.mget<(string | SignupApplication | null)[]>(...keys);
	const apps: SignupApplication[] = [];
	for (const raw of raws) {
		if (!raw) continue;
		const parsed = typeof raw === 'string' ? (JSON.parse(raw) as SignupApplication) : raw;
		if (filter?.status && parsed.status !== filter.status) continue;
		apps.push(parsed);
	}
	return apps;
}

/** Update an application's status. Sets processedAt to now if transitioning away from pending. */
export async function updateSignupStatus(
	id: string,
	status: SignupStatus,
	rejectReason?: string
): Promise<SignupApplication | null> {
	const app = await getSignup(id);
	if (!app) return null;
	const updated: SignupApplication = {
		...app,
		status,
		processedAt: status === 'pending' ? app.processedAt : Date.now(),
		rejectReason: status === 'rejected' ? rejectReason : undefined
	};
	await redis.set(SIGNUP_KEY(id), JSON.stringify(updated), { ex: ONE_YEAR_SECONDS });
	return updated;
}

/**
 * Check whether a requested slug is already in use by an existing tenant
 * OR by a non-rejected signup application. Lets the form reject
 * duplicates client-side before the user submits.
 */
export async function isSlugTaken(slug: string, existingTenantSlugs: string[]): Promise<boolean> {
	if (existingTenantSlugs.includes(slug)) return true;
	const apps = await listSignups();
	return apps.some((a) => a.slug === slug && a.status !== 'rejected');
}

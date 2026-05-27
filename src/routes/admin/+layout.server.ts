import type { LayoutServerLoad } from './$types';

/**
 * Platform-level admin parent. The Basic-Auth gate lives in
 * `src/hooks.server.ts` (PLATFORM_ADMIN_PASSWORD) — this load function
 * just forwards parent data so the admin/* subtree shares one layout
 * marker. Tenant-level admin lives under `/[slug]/admin/` and uses
 * the per-tenant password instead.
 */
export const load: LayoutServerLoad = async ({ parent }) => parent();

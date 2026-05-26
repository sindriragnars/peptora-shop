// See https://svelte.dev/docs/kit/types#app
import type { TenantConfig } from '$lib/tenants';

declare global {
	namespace App {
		interface Locals {
			tenant: TenantConfig | null;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

/**
 * Transactional email via Resend.
 *
 * Two templates per order:
 *   1. Customer confirmation — sent from tenant.contact.email, to the
 *      buyer. "Takk fyrir pöntunina" + order summary.
 *   2. Admin notification — sent to tenant.contact.email, telling the
 *      tenant a new paid order needs fulfilment.
 *
 * Resend free tier: 3,000 emails / month — generous for our scale. API
 * key lives in process.env.RESEND_API_KEY (Vercel project env). Sender
 * domain must be verified in Resend dashboard before sends from
 * arbitrary tenant emails work; until then use a fallback platform
 * sender configured in env.
 */
import { Resend } from 'resend';
import type { Order } from './orders';
import type { TenantConfig } from './tenants';
import type { SignupApplication } from './signups';

let _resend: Resend | null = null;
function resendClient(): Resend {
	if (_resend) return _resend;
	const key = process.env.RESEND_API_KEY;
	if (!key) throw new Error('Missing RESEND_API_KEY env var');
	_resend = new Resend(key);
	return _resend;
}

function fmtISK(amount: number): string {
	return `${amount.toLocaleString('is-IS')} kr.`;
}

function platformSender(): string {
	// Fallback for tenants who haven't verified their own sender domain
	// in Resend yet. Phase 6 onboarding will walk clients through the
	// domain verification + flip them onto their own from-address.
	return process.env.PLATFORM_EMAIL_FROM ?? 'orders@peptora.app';
}

/**
 * Send customer order confirmation. Best-effort: failures are logged
 * but do not block the webhook handler — the order is already paid and
 * persisted in Redis, the receipt is a nice-to-have. Re-sending failed
 * confirmations is a Phase 4 admin task.
 */
export async function sendOrderConfirmationToCustomer(opts: {
	order: Order;
	tenant: TenantConfig;
}): Promise<void> {
	const { order, tenant } = opts;
	try {
		await resendClient().emails.send({
			from: `${tenant.name} <${platformSender()}>`,
			to: order.customer.email,
			replyTo: tenant.contact.email,
			subject: `Pöntun staðfest hjá ${tenant.name}`,
			html: customerHtml({ order, tenant })
		});
	} catch (e) {
		console.warn('order confirmation email failed', { orderId: order.id, error: String(e) });
	}
}

/**
 * Notify the tenant admin that a new order needs fulfilment. Sent to
 * tenant.contact.email (which doubles as the admin inbox in Phase 3 —
 * a separate admin email field can be added later if a tenant wants
 * customer enquiries + order notifications routed differently).
 */
export async function sendOrderNotificationToAdmin(opts: {
	order: Order;
	tenant: TenantConfig;
}): Promise<void> {
	const { order, tenant } = opts;
	try {
		await resendClient().emails.send({
			from: `Peptora Shop <${platformSender()}>`,
			to: tenant.contact.email,
			subject: `Ný pöntun #${order.id.slice(0, 8)} — ${fmtISK(order.totalISK)}`,
			html: adminHtml({ order, tenant })
		});
	} catch (e) {
		console.warn('admin notification email failed', { orderId: order.id, error: String(e) });
	}
}

// ─── Signup notifications (Phase 7) ────────────────────────────────────────

/**
 * Tell the platform admin (Sindri / Peptora team) that a new shop
 * signup needs review. Best-effort. PLATFORM_ADMIN_EMAIL is required
 * for this to fire — without it the signup still saves to Redis and
 * shows up in /admin/signups, the admin just has to remember to check.
 */
export async function sendSignupNotificationToAdmin(opts: {
	application: SignupApplication;
}): Promise<void> {
	const { application: app } = opts;
	const to = process.env.PLATFORM_ADMIN_EMAIL;
	if (!to) {
		console.warn('signup notification skipped — PLATFORM_ADMIN_EMAIL not set');
		return;
	}
	try {
		await resendClient().emails.send({
			from: `Peptora Shop <${platformSender()}>`,
			to,
			replyTo: app.email,
			subject: `Ný umsókn um verslun: ${app.name} (${app.slug})`,
			html: signupAdminHtml(app)
		});
	} catch (e) {
		console.warn('signup admin notification failed', { signupId: app.id, error: String(e) });
	}
}

/**
 * Tell the applicant their shop is approved + give them the URL +
 * onboarding next-steps. Sent on the Approve action in /admin/signups.
 */
export async function sendSignupApprovalEmail(opts: {
	application: SignupApplication;
}): Promise<void> {
	const { application: app } = opts;
	try {
		await resendClient().emails.send({
			from: `Peptora Shop <${platformSender()}>`,
			to: app.email,
			subject: `Verslun samþykkt: ${app.name}`,
			html: signupApprovalHtml(app)
		});
	} catch (e) {
		console.warn('signup approval email failed', { signupId: app.id, error: String(e) });
	}
}

// ─── HTML templates ────────────────────────────────────────────────────────
// Inline-styled HTML strings rather than a templating library — Resend
// renders these directly and inline styles maximize email-client
// compatibility (Gmail, Outlook web, Apple Mail all handle this fine).

function itemsTable(order: Order): string {
	const rows = order.items
		.map(
			(it) => `
		<tr>
			<td style="padding:8px 0;border-bottom:1px solid #ebe5d4;">${escapeHtml(it.title)} <span style="color:#6b6b6b">× ${it.qty}</span></td>
			<td style="padding:8px 0;border-bottom:1px solid #ebe5d4;text-align:right;font-family:ui-monospace,monospace;">${fmtISK(it.lineTotalISK)}</td>
		</tr>`
		)
		.join('');
	return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

function summaryTable(order: Order): string {
	return `
	<table style="width:100%;border-collapse:collapse;margin:8px 0;">
		<tr><td style="padding:4px 0;color:#6b6b6b">Vörur</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;">${fmtISK(order.subtotalISK)}</td></tr>
		<tr><td style="padding:4px 0;color:#6b6b6b">Sending (${escapeHtml(order.shipping.option)})</td><td style="padding:4px 0;text-align:right;font-family:ui-monospace,monospace;">${fmtISK(order.shipping.costISK)}</td></tr>
		<tr><td style="padding:8px 0 4px;border-top:1px solid #0f1814;font-weight:600">Samtals</td><td style="padding:8px 0 4px;border-top:1px solid #0f1814;text-align:right;font-family:ui-monospace,monospace;font-weight:600">${fmtISK(order.totalISK)}</td></tr>
	</table>`;
}

function customerHtml({ order, tenant }: { order: Order; tenant: TenantConfig }): string {
	return `<!doctype html>
<html lang="is"><body style="font-family:Inter,system-ui,sans-serif;color:#0f1814;background:#f5f1e8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
	<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:${tenant.theme.brand}">Takk fyrir pöntunina</h1>
	<p style="margin:0 0 8px;">Sæl/-l ${escapeHtml(order.customer.name)},</p>
	<p style="margin:0 0 16px;color:#6b6b6b">Við höfum móttekið pöntun #${order.id.slice(0, 8)} hjá ${escapeHtml(tenant.name)}. Þú færð aðra tölvupóstssendingu þegar pakkinn er á leiðinni.</p>
	<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Vörur</h2>
	${itemsTable(order)}
	${summaryTable(order)}
	<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Sendingarheimilisfang</h2>
	<p style="margin:0;line-height:1.5;">
		${escapeHtml(order.customer.name)}<br/>
		${escapeHtml(order.customer.address)}<br/>
		${escapeHtml(order.customer.postalCode)} ${escapeHtml(order.customer.city)}<br/>
		${escapeHtml(order.customer.phone)}
	</p>
	<p style="margin:32px 0 0;font-size:12px;color:#6b6b6b">Spurningar? Svaraðu þessum pósti og ${escapeHtml(tenant.name)} fær hann beint.</p>
</div>
</body></html>`;
}

function adminHtml({ order, tenant }: { order: Order; tenant: TenantConfig }): string {
	return `<!doctype html>
<html lang="is"><body style="font-family:Inter,system-ui,sans-serif;color:#0f1814;background:#f5f1e8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
	<h1 style="margin:0 0 8px;font-size:20px">Ný pöntun — #${order.id.slice(0, 8)}</h1>
	<p style="margin:0 0 16px;color:#6b6b6b">${escapeHtml(tenant.name)} · ${fmtISK(order.totalISK)} · ${escapeHtml(order.shipping.option)}</p>
	<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Vörur</h2>
	${itemsTable(order)}
	${summaryTable(order)}
	<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Sendingarheimilisfang</h2>
	<p style="margin:0;line-height:1.5;">
		<strong>${escapeHtml(order.customer.name)}</strong><br/>
		${escapeHtml(order.customer.email)}<br/>
		${escapeHtml(order.customer.phone)}<br/>
		${escapeHtml(order.customer.address)}<br/>
		${escapeHtml(order.customer.postalCode)} ${escapeHtml(order.customer.city)}
	</p>
	${order.customer.notes ? `<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Athugasemd</h2><p style="margin:0">${escapeHtml(order.customer.notes)}</p>` : ''}
</div>
</body></html>`;
}

function signupAdminHtml(app: SignupApplication): string {
	return `<!doctype html>
<html lang="is"><body style="font-family:Inter,system-ui,sans-serif;color:#0f1814;background:#f5f1e8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
	<h1 style="margin:0 0 8px;font-size:20px">Ný umsókn um verslun</h1>
	<p style="margin:0 0 16px;color:#6b6b6b">${escapeHtml(app.name)} — slug <code style="font-family:ui-monospace,monospace;background:#ebe5d4;padding:2px 6px;border-radius:4px;">${escapeHtml(app.slug)}</code></p>
	<table style="width:100%;border-collapse:collapse;font-size:14px;line-height:1.6;">
		<tr><td style="padding:4px 0;color:#6b6b6b;width:30%">Eigandi</td><td>${escapeHtml(app.ownerName)}</td></tr>
		<tr><td style="padding:4px 0;color:#6b6b6b">Netfang</td><td><a href="mailto:${escapeHtml(app.email)}">${escapeHtml(app.email)}</a></td></tr>
		${app.phone ? `<tr><td style="padding:4px 0;color:#6b6b6b">Sími</td><td>${escapeHtml(app.phone)}</td></tr>` : ''}
		${app.address ? `<tr><td style="padding:4px 0;color:#6b6b6b">Heimilisfang</td><td>${escapeHtml(app.address)}</td></tr>` : ''}
		<tr><td style="padding:4px 0;color:#6b6b6b">Brand litur</td><td><span style="display:inline-block;width:14px;height:14px;background:${escapeHtml(app.brandColor)};border-radius:3px;vertical-align:middle;margin-right:6px;"></span><code style="font-family:ui-monospace,monospace;">${escapeHtml(app.brandColor)}</code></td></tr>
		<tr><td style="padding:4px 0;color:#6b6b6b">Sending</td><td>${fmtISK(app.flatRateISK)} (frítt yfir ${fmtISK(app.freeShippingISK)})</td></tr>
	</table>
	<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Lýsing</h2>
	<p style="margin:0;white-space:pre-wrap;line-height:1.5;">${escapeHtml(app.description)}</p>
	<p style="margin:24px 0 0;font-size:13px;color:#6b6b6b">Skoða + samþykkja á <a href="https://shop.peptora.app/admin/signups">shop.peptora.app/admin/signups</a></p>
</div>
</body></html>`;
}

function signupApprovalHtml(app: SignupApplication): string {
	const url = `https://shop.peptora.app/${app.slug}`;
	return `<!doctype html>
<html lang="is"><body style="font-family:Inter,system-ui,sans-serif;color:#0f1814;background:#f5f1e8;margin:0;padding:24px;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
	<h1 style="margin:0 0 16px;font-size:22px;color:${escapeHtml(app.brandColor)}">${escapeHtml(app.name)} er samþykkt</h1>
	<p style="margin:0 0 12px;">Sæl/-l ${escapeHtml(app.ownerName)},</p>
	<p style="margin:0 0 16px;">Verslunin þín á Peptora Shop er nú virk. Þú getur skoðað hana á:</p>
	<p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block;background:${escapeHtml(app.brandColor)};color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600">${url}</a></p>
	<h2 style="font-size:14px;text-transform:uppercase;color:#6b6b6b;margin:24px 0 8px;letter-spacing:.05em">Næstu skref</h2>
	<p style="margin:0 0 8px;">Við sendum þér sér tölvupóst með innskráningarupplýsingum fyrir vöru-stjórnborðið næstu klukkutímana, ásamt admin-aðgangi til að sjá pantanir.</p>
	<p style="margin:0 0 16px;color:#6b6b6b;font-size:13px;">Spurningar? Svaraðu þessum pósti — við svörum innan dags.</p>
</div>
</body></html>`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

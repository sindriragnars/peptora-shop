#!/usr/bin/env node
/**
 * Per-tenant Android APK builder.
 *
 * Reads content/tenants/<slug>/tenant.json, rewrites capacitor.config.ts
 * to point at that tenant (appId, appName, server.url), syncs Capacitor
 * into android/, then runs gradle assembleDebug. The resulting APK is
 * copied to dist/<slug>-debug.apk so the client can sideload it.
 *
 * Usage:
 *   node scripts/build-apk.mjs <slug>           # debug build (default keystore)
 *   node scripts/build-apk.mjs <slug> --release # release build (signed)
 *
 * Release builds require the client's keystore to be configured in
 * android/keystore.properties (gitignored). For now we ship debug.
 *
 * Note: capacitor.config.ts in the repo is the demo template; after a
 * non-demo build, run `node scripts/build-apk.mjs demo` to restore it,
 * or commit only the demo state.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const slug = args[0];
const isRelease = args.includes('--release');

if (!slug) {
	console.error('Usage: node scripts/build-apk.mjs <slug> [--release]');
	process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const tenantPath = join(root, 'content', 'tenants', slug, 'tenant.json');

if (!existsSync(tenantPath)) {
	console.error(`Tenant config not found: ${tenantPath}`);
	process.exit(1);
}

const tenant = JSON.parse(readFileSync(tenantPath, 'utf8'));

// Build the production URL for this tenant. Subdomains are wired in
// Vercel as of 2026-05-26 — each tenant gets `<slug>.peptora.app`
// pointing at the peptora-shop project. The path-based form remains
// supported by the tenant resolver for dev + preview.
const serverUrl = `https://${slug}.peptora.app`;
const appId = `app.peptora.shop.${slug.replace(/-/g, '')}`;

console.log(`[build-apk] tenant=${slug}`);
console.log(`[build-apk] appId=${appId}`);
console.log(`[build-apk] serverUrl=${serverUrl}`);

// Rewrite capacitor.config.ts in place. We use a regex on the known
// template values so re-running for the same slug is idempotent.
const configPath = join(root, 'capacitor.config.ts');
let config = readFileSync(configPath, 'utf8');
config = config.replace(/appId: '[^']+'/, `appId: '${appId}'`);
config = config.replace(/appName: '[^']+'/, `appName: '${tenant.name.replace(/'/g, "\\'")}'`);
config = config.replace(/url: 'https:\/\/[^']+'/, `url: '${serverUrl}'`);
writeFileSync(configPath, config);

console.log('[build-apk] generating tenant icon + splash...');
execSync(`node scripts/generate-tenant-assets.mjs ${slug}`, { cwd: root, stdio: 'inherit' });

console.log('[build-apk] slicing Android density variants via @capacitor/assets...');
execSync('npx @capacitor/assets generate --android --assetPath capacitor-assets', {
	cwd: root,
	stdio: 'inherit'
});

console.log('[build-apk] capacitor sync...');
execSync('npx cap sync android', { cwd: root, stdio: 'inherit' });

const gradleTask = isRelease ? 'assembleRelease' : 'assembleDebug';
const gradleVariant = isRelease ? 'release' : 'debug';

console.log(`[build-apk] gradle ${gradleTask}...`);
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
execSync(`${gradlew} ${gradleTask}`, {
	cwd: join(root, 'android'),
	stdio: 'inherit',
	shell: true,
	env: {
		...process.env,
		JAVA_HOME: process.env.JAVA_HOME ?? 'C:\\Program Files\\Android\\Android Studio\\jbr'
	}
});

const builtApk = join(
	root,
	'android',
	'app',
	'build',
	'outputs',
	'apk',
	gradleVariant,
	`app-${gradleVariant}.apk`
);
const distDir = join(root, 'dist');
mkdirSync(distDir, { recursive: true });
const distApk = join(distDir, `${slug}-${gradleVariant}.apk`);
copyFileSync(builtApk, distApk);

console.log(`[build-apk] ✓ ${distApk}`);

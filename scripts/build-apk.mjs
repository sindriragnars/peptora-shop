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
import {
	copyFileSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	existsSync,
	readdirSync
} from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const isRelease = args.includes('--release');
const isStandalone = args.includes('--standalone');
// First non-flag positional arg is the tenant slug. Optional under
// --standalone (the script doesn't read a tenant config in that case).
const slug = args.find((a) => !a.startsWith('--'));

if (!slug && !isStandalone) {
	console.error('Usage: node scripts/build-apk.mjs <slug> [--release]');
	console.error('       node scripts/build-apk.mjs --standalone [--release]');
	process.exit(1);
}

const root = resolve(import.meta.dirname, '..');

// --standalone: build the generic Peptora APK that opens the WebApp
// at app.peptora.app, no per-tenant shop. Same Peptora icon + name
// every other build uses; appId is distinct from the tenant pattern
// so it installs alongside any tenant APK without conflict.
let serverUrl;
let appId;
if (isStandalone) {
	serverUrl = 'https://app.peptora.app';
	appId = 'app.peptora.standalone';
	console.log('[build-apk] standalone build (app.peptora.app, no tenant shop)');
} else {
	const tenantPath = join(root, 'content', 'tenants', slug, 'tenant.json');
	if (!existsSync(tenantPath)) {
		console.error(`Tenant config not found: ${tenantPath}`);
		process.exit(1);
	}
	// Read for side-effect validation; tenant fields no longer flow
	// into the APK (name + icon are always Peptora) but missing tenant
	// config still means "wrong slug".
	JSON.parse(readFileSync(tenantPath, 'utf8'));
	serverUrl = `https://${slug}.peptora.app`;
	appId = `app.peptora.shop.${slug.replace(/-/g, '')}`;
	console.log(`[build-apk] tenant=${slug}`);
}
const appName = 'Peptora';
const outputLabel = isStandalone ? 'standalone' : slug;

console.log(`[build-apk] appId=${appId}`);
console.log(`[build-apk] appName=${appName} (always Peptora — brand unification)`);
console.log(`[build-apk] serverUrl=${serverUrl}`);

// Rewrite capacitor.config.ts in place. We use a regex on the known
// template values so re-running for the same slug is idempotent.
const configPath = join(root, 'capacitor.config.ts');
let config = readFileSync(configPath, 'utf8');
config = config.replace(/appId: '[^']+'/, `appId: '${appId}'`);
config = config.replace(/appName: '[^']+'/, `appName: '${appName}'`);
config = config.replace(/url: 'https:\/\/[^']+'/, `url: '${serverUrl}'`);
writeFileSync(configPath, config);

// Capacitor sync doesn't propagate appId to android/app/build.gradle —
// the Gradle applicationId is set once when the native project is
// generated and never touched after. Rewrite it in place so the built
// APK ships with the right package name (otherwise every tenant APK
// would install over the same Gradle-default package and Sindri's
// "install side-by-side" guarantee would silently break).
const gradlePath = join(root, 'android', 'app', 'build.gradle');
let gradleFile = readFileSync(gradlePath, 'utf8');
gradleFile = gradleFile.replace(
	/applicationId\s+"[^"]+"/,
	`applicationId "${appId}"`
);
writeFileSync(gradlePath, gradleFile);

// Copy the canonical Peptora source assets into capacitor-assets/,
// replacing anything left behind from a previous tenant build. The
// tenant-letter-square generator (scripts/generate-tenant-assets.mjs)
// is intentionally NOT called — every APK ships with the Peptora icon.
console.log('[build-apk] staging Peptora source assets...');
const sourceDir = join(root, 'peptora-source');
const targetDir = join(root, 'capacitor-assets');
mkdirSync(targetDir, { recursive: true });
for (const file of readdirSync(sourceDir)) {
	copyFileSync(join(sourceDir, file), join(targetDir, file));
}

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
const distApk = join(distDir, `${outputLabel}-${gradleVariant}.apk`);
copyFileSync(builtApk, distApk);

console.log(`[build-apk] ✓ ${distApk}`);

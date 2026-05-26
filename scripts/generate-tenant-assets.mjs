#!/usr/bin/env node
/**
 * Tenant asset generator.
 *
 * Reads `content/tenants/<slug>/tenant.json` and renders the source
 * PNGs that `@capacitor/assets` consumes to slice into all Android
 * density variants:
 *
 *   capacitor-assets/icon-only.png        (1024×1024)
 *   capacitor-assets/icon-foreground.png  (1024×1024, letter on transparent)
 *   capacitor-assets/icon-background.png  (1024×1024, brand fill)
 *   capacitor-assets/splash.png           (2732×2732)
 *   capacitor-assets/splash-dark.png      (2732×2732, same as light for now)
 *
 * Design is intentionally minimal: a rounded-corner square in the
 * tenant's brand colour with the first letter of the tenant name in
 * white. Cheap to generate, gives every tenant a recognisable
 * launcher icon without a logo asset. When a tenant ships a real
 * logo we'll wire `tenant.logo` in here.
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const slug = process.argv[2];
if (!slug) {
	console.error('Usage: node scripts/generate-tenant-assets.mjs <slug>');
	process.exit(1);
}

const root = resolve(import.meta.dirname, '..');
const tenant = JSON.parse(
	readFileSync(join(root, 'content', 'tenants', slug, 'tenant.json'), 'utf8')
);

const brand = tenant.theme.brand;
const letter = tenant.name.trim().charAt(0).toUpperCase();
const outDir = join(root, 'capacitor-assets');
mkdirSync(outDir, { recursive: true });

const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;

function escapeXml(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function renderIconFilled() {
	const fontSize = ICON_SIZE * 0.55;
	const cy = ICON_SIZE / 2 + fontSize * 0.35;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
		<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${brand}" rx="${ICON_SIZE * 0.18}"/>
		<text x="${ICON_SIZE / 2}" y="${cy}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">${escapeXml(letter)}</text>
	</svg>`;
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderIconForeground() {
	// Adaptive icon foreground: letter on transparent, sized within the
	// 66% safe zone (Google guideline — outer ring may be cropped).
	const fontSize = ICON_SIZE * 0.4;
	const cy = ICON_SIZE / 2 + fontSize * 0.35;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
		<text x="${ICON_SIZE / 2}" y="${cy}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">${escapeXml(letter)}</text>
	</svg>`;
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderIconBackground() {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
		<rect width="${ICON_SIZE}" height="${ICON_SIZE}" fill="${brand}"/>
	</svg>`;
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function renderSplash() {
	const fontSize = SPLASH_SIZE * 0.25;
	const cy = SPLASH_SIZE / 2 + fontSize * 0.35;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" viewBox="0 0 ${SPLASH_SIZE} ${SPLASH_SIZE}">
		<rect width="${SPLASH_SIZE}" height="${SPLASH_SIZE}" fill="${brand}"/>
		<text x="${SPLASH_SIZE / 2}" y="${cy}" font-family="Helvetica, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="white" text-anchor="middle">${escapeXml(letter)}</text>
	</svg>`;
	return sharp(Buffer.from(svg)).png().toBuffer();
}

const [iconFilled, iconFg, iconBg, splash] = await Promise.all([
	renderIconFilled(),
	renderIconForeground(),
	renderIconBackground(),
	renderSplash()
]);

writeFileSync(join(outDir, 'icon-only.png'), iconFilled);
writeFileSync(join(outDir, 'icon-foreground.png'), iconFg);
writeFileSync(join(outDir, 'icon-background.png'), iconBg);
writeFileSync(join(outDir, 'splash.png'), splash);
writeFileSync(join(outDir, 'splash-dark.png'), splash);

console.log(`[assets] ✓ ${slug}: brand=${brand} letter=${letter}`);

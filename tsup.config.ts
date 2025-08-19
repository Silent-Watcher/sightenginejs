import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/*'],
	format: ['esm'], // Keep ESM format
	outDir: 'dist',
	dts: true,
	shims: true,
	clean: true,
	minify: true,
	external: ['fs/promises', 'path', 'form-data', 'node-fetch'],
	outExtension: () => ({ js: '.js' }), // Force .js instead of .mjs
});

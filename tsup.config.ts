import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/*'],
	format: ['esm'], // Keep ESM format
	outDir: 'dist',
	dts: true,
	shims: true,
	clean: true,
	minify: true,
	outExtension: () => ({ js: '.js' }), // Force .js instead of .mjs
	esbuildOptions: (options) => {
		options.alias = {
			'#app': './src', // Resolve #app/* to the src folder
		};
	},
});

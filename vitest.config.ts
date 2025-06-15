import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			enabled: true,
			reporter: ['json-summary'],
			all: true,

			include: ['src/**/*.ts'],
			exclude: ['src/index.ts', 'src/types.ts'],
		},
	},
	resolve: {
		conditions: ['my-package-dev'],
	},
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
		globals: true,
		coverage: {
			provider: 'v8',
			enabled: true,
			reporter: ['json-summary', 'json'],
			all: true,

			include: ['src/**/*.ts'],
			exclude: ['src/index.ts', 'src/types.ts', 'src/thresholds'],
		},
	},
	resolve: {
		conditions: ['my-package-dev'],
	},
});

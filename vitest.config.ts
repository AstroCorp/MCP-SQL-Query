import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			'@': path.resolve(root, './src'),
		},
	},
	test: {
		exclude: ['**/node_modules/**', '**/dist/**'],
		passWithNoTests: true,
		globals: true,
		environment: 'node',
		testTimeout: 60000,
		pool: 'forks',
	},
});

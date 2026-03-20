import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	resolve: {
		alias: {
			$lib: path.resolve(__dirname, 'src/lib')
		}
	},
	test: {
		setupFiles: ['fake-indexeddb/auto'],
		exclude: ['e2e/**', 'node_modules/**']
	}
});

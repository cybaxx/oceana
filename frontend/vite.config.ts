import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import tslOperatorPlugin from 'vite-plugin-tsl-operator';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tslOperatorPlugin(), tailwindcss(), sveltekit()],
	server: {
		proxy: {
			'/api/v1/ws': {
				target: 'http://backend:3000',
				ws: true
			},
			'/api/v1': {
				target: 'http://backend:3000'
			}
		}
	}
});

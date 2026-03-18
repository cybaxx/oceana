import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
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

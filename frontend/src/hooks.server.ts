import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const API_BASE = env.API_URL || 'http://localhost:3001';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/')) {
		const target = `${API_BASE}${event.url.pathname}${event.url.search}`;
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		const authHeader = event.request.headers.get('authorization');
		if (authHeader) {
			headers['Authorization'] = authHeader;
		}

		const res = await fetch(target, {
			method: event.request.method,
			headers,
			body: event.request.method !== 'GET' && event.request.method !== 'HEAD'
				? await event.request.text()
				: undefined
		});

		const body = await res.text();
		return new Response(body, {
			status: res.status,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return resolve(event);
};

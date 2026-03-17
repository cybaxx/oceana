import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const API_BASE = env.API_URL || 'http://localhost:3001';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api/')) {
		const target = `${API_BASE}${event.url.pathname}${event.url.search}`;
		const headers = new Headers();

		// Forward relevant headers from the original request
		const authHeader = event.request.headers.get('authorization');
		if (authHeader) {
			headers.set('Authorization', authHeader);
		}

		const contentType = event.request.headers.get('content-type');
		if (contentType) {
			headers.set('Content-Type', contentType);
		}

		let body: BodyInit | undefined;
		if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
			body = await event.request.arrayBuffer();
		}

		const res = await fetch(target, {
			method: event.request.method,
			headers,
			body
		});

		// Pass through the response as-is, preserving content type
		const resBody = await res.arrayBuffer();
		const resHeaders = new Headers();
		const resContentType = res.headers.get('content-type');
		if (resContentType) {
			resHeaders.set('Content-Type', resContentType);
		}
		const cacheControl = res.headers.get('cache-control');
		if (cacheControl) {
			resHeaders.set('Cache-Control', cacheControl);
		}

		return new Response(resBody, {
			status: res.status,
			headers: resHeaders
		});
	}

	return resolve(event);
};

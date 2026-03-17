import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';

const BASE = '/api/v1';

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const state = get(auth);
	if (state.token) {
		headers['Authorization'] = `Bearer ${state.token}`;
	}

	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(err.error || err.message || res.statusText);
	}

	return res.json();
}

export const api = {
	// Auth
	register: (username: string, email: string, password: string) =>
		request('POST', '/auth/register', { username, email, password }),

	login: (email: string, password: string) =>
		request('POST', '/auth/login', { email, password }),

	// Users
	getUser: (id: string) => request('GET', `/users/${id}`),

	updateProfile: (data: { display_name?: string; bio?: string }) =>
		request('PUT', '/profile', data),

	// Follow
	follow: (id: string) => request('POST', `/users/${id}/follow`),
	unfollow: (id: string) => request('DELETE', `/users/${id}/follow`),

	// Posts
	createPost: (content: string, parent_id?: string) => request('POST', '/posts', { content, parent_id }),
	getReplies: (id: string) => request('GET', `/posts/${id}/replies`),
	getPost: (id: string) => request('GET', `/posts/${id}`),
	deletePost: (id: string) => request('DELETE', `/posts/${id}`),
	reactToPost: (id: string, kind: 'like' | 'yikes') => request('POST', `/posts/${id}/react`, { kind }),
	unreactToPost: (id: string) => request('DELETE', `/posts/${id}/react`),

	// Feed
	getFeed: (before?: string, limit?: number) => {
		const params = new URLSearchParams();
		if (before) params.set('before', before);
		if (limit) params.set('limit', String(limit));
		const qs = params.toString();
		return request('GET', `/feed${qs ? `?${qs}` : ''}`);
	},

	// Chat
	createConversation: (participant_ids: string[]) =>
		request('POST', '/chats', { participant_ids }),

	listConversations: () => request('GET', '/chats'),

	uploadImage: async (file: File): Promise<{ url: string }> => {
		const state = get(auth);
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch(`${BASE}/upload`, {
			method: 'POST',
			headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
			body: formData
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({ error: res.statusText }));
			throw new Error(err.error || err.message || res.statusText);
		}
		return res.json();
	},

	getMessages: (conversationId: string, before?: string, limit?: number) => {
		const params = new URLSearchParams();
		if (before) params.set('before', before);
		if (limit) params.set('limit', String(limit));
		const qs = params.toString();
		return request('GET', `/chats/${conversationId}/messages${qs ? `?${qs}` : ''}`);
	}
};

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
		if (res.status === 401 && state.token) {
			auth.logout();
			if (typeof window !== 'undefined') window.location.href = '/login';
		}
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

	updateProfile: (data: { display_name?: string; bio?: string; avatar_url?: string }) =>
		request('PUT', '/profile', data),

	// Follow
	follow: (id: string) => request('POST', `/users/${id}/follow`),
	unfollow: (id: string) => request('DELETE', `/users/${id}/follow`),
	getFollowers: (id: string) => request('GET', `/users/${id}/followers`),
	getFollowing: (id: string) => request('GET', `/users/${id}/following`),

	// Posts
	createPost: (content: string, parent_id?: string, signature?: string) =>
		request('POST', '/posts', { content, parent_id, signature }),
	getReplies: (id: string) => request('GET', `/posts/${id}/replies`),
	getPost: (id: string) => request('GET', `/posts/${id}`),
	deletePost: (id: string) => request('DELETE', `/posts/${id}`),
	reactToPost: (id: string, kind: string) => request('POST', `/posts/${id}/react`, { kind }),
	unreactToPost: (id: string) => request('DELETE', `/posts/${id}/react`),

	// Feed
	getFeed: (cursor?: string, limit?: number) => {
		const params = new URLSearchParams();
		if (cursor) params.set('cursor', cursor);
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

	getMessages: (conversationId: string, cursor?: string, limit?: number) => {
		const params = new URLSearchParams();
		if (cursor) params.set('cursor', cursor);
		if (limit) params.set('limit', String(limit));
		const qs = params.toString();
		return request('GET', `/chats/${conversationId}/messages${qs ? `?${qs}` : ''}`);
	},

	// Signal Protocol keys
	uploadKeyBundle: (bundle: {
		identity_key: string;
		signed_prekey: string;
		signed_prekey_signature: string;
		signed_prekey_id: number;
		one_time_prekeys: { key_id: number; public_key: string }[];
		signing_key?: string;
	}) => request('PUT', '/keys/bundle', bundle),

	getKeyBundle: (userId: string) => request('GET', `/keys/bundle/${userId}`),

	getKeyCount: () => request('GET', '/keys/count'),

	getConversationMembers: (conversationId: string): Promise<string[]> =>
		request('GET', `/chats/${conversationId}/members`),

	searchUsers: (q: string) => request('GET', `/users/search?q=${encodeURIComponent(q)}`),

	getWsTicket: () => request<{ ticket: string }>('POST', '/ws/ticket')
};

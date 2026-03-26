import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import type { User } from '$lib/types';

// Mock $app/environment
vi.mock('$app/environment', () => ({ browser: false }));

const mockUser: User = {
	id: '123',
	username: 'alice',
	email: 'alice@test.com',
	display_name: null,
	bio: null,
	is_bot: false,
	avatar_url: null,
	created_at: '2026-01-01T00:00:00Z'
};

let api: typeof import('$lib/api').api;
let auth: typeof import('$lib/stores/auth').auth;

beforeEach(async () => {
	vi.restoreAllMocks();
	// Reset modules to get fresh instances with fresh refreshPromise
	vi.resetModules();
	vi.mock('$app/environment', () => ({ browser: false }));
	const apiMod = await import('$lib/api');
	const authMod = await import('$lib/stores/auth');
	api = apiMod.api;
	auth = authMod.auth;
	auth.logout();
});

function mockFetch(...responses: Array<{ status: number; body?: unknown }>) {
	let callIndex = 0;
	const fn = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
		const resp = responses[callIndex] ?? responses[responses.length - 1];
		callIndex++;
		return new Response(JSON.stringify(resp.body ?? {}), {
			status: resp.status,
			headers: { 'Content-Type': 'application/json' }
		});
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}

describe('api refresh logic', () => {
	it('401 triggers refresh then retries original request', async () => {
		auth.login(mockUser, 'old-token', 'old-refresh');
		const fn = mockFetch(
			{ status: 401 },
			{
				status: 200,
				body: { user: mockUser, token: 'new-token', refresh_token: 'new-refresh' }
			},
			{ status: 200, body: { data: 'ok' } }
		);

		const result = await api.getFeed();
		expect(result).toEqual({ data: 'ok' });
		expect(fn).toHaveBeenCalledTimes(3);
		expect(String(fn.mock.calls[1][0])).toContain('/auth/refresh');
		const retryInit = fn.mock.calls[2][1] as RequestInit;
		expect((retryInit.headers as Record<string, string>)['Authorization']).toBe(
			'Bearer new-token'
		);
	});

	it('concurrent 401s produce single refresh call', async () => {
		auth.login(mockUser, 'old-token', 'old-refresh');

		let callCount = 0;
		const fn = vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
			callCount++;
			const n = callCount;
			if (String(url).includes('/auth/refresh')) {
				return new Response(
					JSON.stringify({
						user: mockUser,
						token: 'new-token',
						refresh_token: 'new-refresh'
					}),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
			if (n <= 3) {
				return new Response(JSON.stringify({}), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			});
		});
		vi.stubGlobal('fetch', fn);

		const results = await Promise.all([api.getFeed(), api.getUser('1'), api.getUser('2')]);
		expect(results).toHaveLength(3);

		const refreshCalls = fn.mock.calls.filter((c) => String(c[0]).includes('/auth/refresh'));
		expect(refreshCalls).toHaveLength(1);
	});

	it('refresh failure triggers logout', async () => {
		auth.login(mockUser, 'old-token', 'old-refresh');
		mockFetch({ status: 401 }, { status: 401 });

		await expect(api.getFeed()).rejects.toThrow('Session expired');
		const state = get(auth);
		expect(state.token).toBeNull();
		expect(state.refresh_token).toBeNull();
	});

	it('no refresh on auth endpoints — immediate error', async () => {
		auth.login(mockUser, 'old-token', 'old-refresh');
		const fn = mockFetch({ status: 401, body: { error: 'Invalid credentials' } });

		await expect(api.login('bad@test.com', 'wrong')).rejects.toThrow();
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it('updatePost sends PUT with content and signature', async () => {
		auth.login(mockUser, 'valid-token', 'valid-refresh');
		const fn = mockFetch({ status: 200, body: { id: '1', content: 'edited', updated_at: '2026-01-01T00:00:00Z' } });

		const result = await api.updatePost('post-1', 'edited', 'sig==');
		expect(result).toEqual({ id: '1', content: 'edited', updated_at: '2026-01-01T00:00:00Z' });
		expect(fn).toHaveBeenCalledTimes(1);
		const [url, init] = fn.mock.calls[0];
		expect(String(url)).toContain('/posts/post-1');
		expect(init?.method).toBe('PUT');
		const body = JSON.parse(init?.body as string);
		expect(body.content).toBe('edited');
		expect(body.signature).toBe('sig==');
	});

	it('updateConversation sends PUT with name', async () => {
		auth.login(mockUser, 'valid-token', 'valid-refresh');
		const fn = mockFetch({ status: 200, body: { id: 'c1', name: 'Ocean Crew' } });

		const result = await api.updateConversation('c1', 'Ocean Crew');
		expect(result).toEqual({ id: 'c1', name: 'Ocean Crew' });
		const [url, init] = fn.mock.calls[0];
		expect(String(url)).toContain('/chats/c1');
		expect(init?.method).toBe('PUT');
		const body = JSON.parse(init?.body as string);
		expect(body.name).toBe('Ocean Crew');
	});

	it('createConversation sends name when provided', async () => {
		auth.login(mockUser, 'valid-token', 'valid-refresh');
		const fn = mockFetch({ status: 200, body: { id: 'c1', name: 'My Chat' } });

		await api.createConversation(['user-1'], 'My Chat');
		const body = JSON.parse(fn.mock.calls[0][1]?.body as string);
		expect(body.name).toBe('My Chat');
		expect(body.participant_ids).toEqual(['user-1']);
	});

	it('createConversation omits name when not provided', async () => {
		auth.login(mockUser, 'valid-token', 'valid-refresh');
		const fn = mockFetch({ status: 200, body: { id: 'c1' } });

		await api.createConversation(['user-1']);
		const body = JSON.parse(fn.mock.calls[0][1]?.body as string);
		expect(body.name).toBeUndefined();
	});

	it('no refresh without refresh token — immediate logout', async () => {
		auth.login(mockUser, 'old-token', '');
		mockFetch({ status: 401, body: { error: 'Unauthorized' } });

		await expect(api.getFeed()).rejects.toThrow('Session expired');
		const state = get(auth);
		expect(state.token).toBeNull();
	});

	it('tokens updated after successful refresh', async () => {
		auth.login(mockUser, 'old-token', 'old-refresh');
		mockFetch(
			{ status: 401 },
			{
				status: 200,
				body: { user: mockUser, token: 'fresh-token', refresh_token: 'fresh-refresh' }
			},
			{ status: 200, body: { result: true } }
		);

		await api.getFeed();
		const state = get(auth);
		expect(state.token).toBe('fresh-token');
		expect(state.refresh_token).toBe('fresh-refresh');
	});
});

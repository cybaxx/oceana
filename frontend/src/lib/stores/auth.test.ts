import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { auth } from '$lib/stores/auth';
import type { User } from '$lib/types';

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

// Mock $app/environment
import { vi } from 'vitest';
vi.mock('$app/environment', () => ({ browser: false }));

describe('auth store', () => {
	beforeEach(() => {
		auth.logout();
	});

	it('login() stores user, token, and refresh_token', () => {
		auth.login(mockUser, 'access-token', 'refresh-token');
		const state = get(auth);
		expect(state.user).toEqual(mockUser);
		expect(state.token).toBe('access-token');
		expect(state.refresh_token).toBe('refresh-token');
	});

	it('setTokens() updates tokens and preserves user', () => {
		auth.login(mockUser, 'old-access', 'old-refresh');
		auth.setTokens('new-access', 'new-refresh');
		const state = get(auth);
		expect(state.user).toEqual(mockUser);
		expect(state.token).toBe('new-access');
		expect(state.refresh_token).toBe('new-refresh');
	});

	it('logout() clears all state', () => {
		auth.login(mockUser, 'token', 'refresh');
		auth.logout();
		const state = get(auth);
		expect(state.user).toBeNull();
		expect(state.token).toBeNull();
		expect(state.refresh_token).toBeNull();
	});
});

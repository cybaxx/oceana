import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { User } from '$lib/types';

interface AuthState {
	user: User | null;
	token: string | null;
	refresh_token: string | null;
}

function createAuthStore() {
	let initial: AuthState = { user: null, token: null, refresh_token: null };

	if (browser) {
		const saved = localStorage.getItem('auth');
		if (saved) {
			try {
				initial = JSON.parse(saved);
			} catch {}
		}
	}

	const { subscribe, set, update } = writable<AuthState>(initial);

	return {
		subscribe,
		login(user: User, token: string, refresh_token: string) {
			const state = { user, token, refresh_token };
			if (browser) localStorage.setItem('auth', JSON.stringify(state));
			set(state);
		},
		updateUser(user: User) {
			update((s) => {
				const state = { ...s, user };
				if (browser) localStorage.setItem('auth', JSON.stringify(state));
				return state;
			});
		},
		setTokens(token: string, refresh_token: string) {
			update((s) => {
				const state = { ...s, token, refresh_token };
				if (browser) localStorage.setItem('auth', JSON.stringify(state));
				return state;
			});
		},
		logout() {
			if (browser) {
				localStorage.removeItem('auth');
				// Clear sent message cache (L-7)
				const keysToRemove: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key?.startsWith('oceana-sent-')) keysToRemove.push(key);
				}
				keysToRemove.forEach((k) => localStorage.removeItem(k));
			}
			set({ user: null, token: null, refresh_token: null });
		}
	};
}

export const auth = createAuthStore();

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { User } from '$lib/types';

interface AuthState {
	user: User | null;
	token: string | null;
}

function createAuthStore() {
	let initial: AuthState = { user: null, token: null };

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
		login(user: User, token: string) {
			const state = { user, token };
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
		logout() {
			if (browser) localStorage.removeItem('auth');
			set({ user: null, token: null });
		}
	};
}

export const auth = createAuthStore();

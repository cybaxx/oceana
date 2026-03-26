import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'bloom-mode';

function createBloomStore() {
	const initial = browser ? localStorage.getItem(KEY) === 'true' : false;
	const { subscribe, set, update } = writable(initial);

	return {
		subscribe,
		toggle() {
			update((v) => {
				const next = !v;
				if (browser) localStorage.setItem(KEY, String(next));
				return next;
			});
		},
		set(value: boolean) {
			if (browser) localStorage.setItem(KEY, String(value));
			set(value);
		}
	};
}

export const bloomMode = createBloomStore();

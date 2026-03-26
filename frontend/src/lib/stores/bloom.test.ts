import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

vi.mock('$app/environment', () => ({ browser: true }));

// Must stub localStorage before bloom module loads
const storage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
	getItem: vi.fn((key: string) => storage[key] ?? null),
	setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
	removeItem: vi.fn((key: string) => { delete storage[key]; }),
	clear: vi.fn(() => { for (const k in storage) delete storage[k]; }),
	length: 0,
	key: vi.fn(() => null),
});

// Now import — module reads localStorage on load
const { bloomMode } = await import('$lib/stores/bloom');

describe('bloom store', () => {
	beforeEach(() => {
		for (const k in storage) delete storage[k];
		bloomMode.set(false);
	});

	it('defaults to false', () => {
		expect(get(bloomMode)).toBe(false);
	});

	it('toggle() flips value from false to true', () => {
		bloomMode.toggle();
		expect(get(bloomMode)).toBe(true);
		expect(localStorage.setItem).toHaveBeenCalledWith('bloom-mode', 'true');
	});

	it('toggle() flips value from true to false', () => {
		bloomMode.set(true);
		bloomMode.toggle();
		expect(get(bloomMode)).toBe(false);
		expect(localStorage.setItem).toHaveBeenCalledWith('bloom-mode', 'false');
	});

	it('set() persists to localStorage', () => {
		bloomMode.set(true);
		expect(localStorage.setItem).toHaveBeenCalledWith('bloom-mode', 'true');
		expect(get(bloomMode)).toBe(true);

		bloomMode.set(false);
		expect(localStorage.setItem).toHaveBeenCalledWith('bloom-mode', 'false');
		expect(get(bloomMode)).toBe(false);
	});

	it('double toggle returns to original value', () => {
		expect(get(bloomMode)).toBe(false);
		bloomMode.toggle();
		bloomMode.toggle();
		expect(get(bloomMode)).toBe(false);
	});
});

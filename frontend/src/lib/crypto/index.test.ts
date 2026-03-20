import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock api before importing anything
vi.mock('$lib/api', () => ({
	api: {
		uploadKeyBundle: vi.fn().mockResolvedValue({}),
		getKeyCount: vi.fn().mockResolvedValue({ count: 50 })
	}
}));

describe('initCrypto', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('first-time init generates keys and uploads bundle', async () => {
		const { initCrypto, getCryptoStore } = await import('./index');
		const { api } = await import('$lib/api');

		expect(getCryptoStore()).toBeNull();

		await initCrypto(`first-init-${Math.random()}`);

		expect(getCryptoStore()).not.toBeNull();
		expect(api.uploadKeyBundle).toHaveBeenCalled();
	});

	it('idempotent — second call returns immediately', async () => {
		const { initCrypto, getCryptoStore } = await import('./index');
		const { api } = await import('$lib/api');

		const userId = `idempotent-${Math.random()}`;
		await initCrypto(userId);
		const callCount = (api.uploadKeyBundle as ReturnType<typeof vi.fn>).mock.calls.length;

		await initCrypto(userId);
		// Should not have called uploadKeyBundle again
		expect((api.uploadKeyBundle as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
	});

	it('existing keys without signing key triggers signing key generation', async () => {
		const { SignalProtocolStore } = await import('./store');
		const { generateIdentityAndKeys } = await import('./keys');

		// Pre-populate a store with identity keys but no signing key
		const userId = `upgrade-${Math.random()}`;
		const preStore = new SignalProtocolStore(userId);
		await preStore.open();
		await generateIdentityAndKeys(preStore);

		// Now initCrypto should detect existing keys and generate signing key
		const { initCrypto, getCryptoStore } = await import('./index');
		const { api } = await import('$lib/api');

		await initCrypto(userId);

		expect(getCryptoStore()).not.toBeNull();
		// Should have uploaded bundle with signing key
		expect(api.uploadKeyBundle).toHaveBeenCalled();
	});

	it('existing keys with signing key does not re-upload bundle', async () => {
		const { SignalProtocolStore } = await import('./store');
		const { generateIdentityAndKeys, generateSigningKey } = await import('./keys');

		const userId = `has-signing-${Math.random()}`;
		const preStore = new SignalProtocolStore(userId);
		await preStore.open();
		await generateIdentityAndKeys(preStore);
		await generateSigningKey(preStore);

		const { initCrypto, getCryptoStore } = await import('./index');
		const { api } = await import('$lib/api');
		const uploadMock = api.uploadKeyBundle as ReturnType<typeof vi.fn>;
		const callsBefore = uploadMock.mock.calls.length;

		await initCrypto(userId);

		expect(getCryptoStore()).not.toBeNull();
		// Should NOT re-upload bundle when signing key already exists
		expect(uploadMock.mock.calls.length).toBe(callsBefore);
	});

	it('page refresh with existing keys does not re-upload bundle', async () => {
		const { SignalProtocolStore } = await import('./store');
		const { generateIdentityAndKeys, generateSigningKey } = await import('./keys');

		// Simulate first page load: generate everything
		const userId = `refresh-${Math.random()}`;
		const preStore = new SignalProtocolStore(userId);
		await preStore.open();
		await generateIdentityAndKeys(preStore);
		await generateSigningKey(preStore);

		const { api } = await import('$lib/api');
		const uploadMock = api.uploadKeyBundle as ReturnType<typeof vi.fn>;

		// Simulate page refresh: reset module state, re-import
		vi.resetModules();
		const { initCrypto, getCryptoStore } = await import('./index');
		const api2 = (await import('$lib/api')).api;
		const uploadMock2 = api2.uploadKeyBundle as ReturnType<typeof vi.fn>;
		const callsBefore = uploadMock2.mock.calls.length;

		await initCrypto(userId);

		expect(getCryptoStore()).not.toBeNull();
		// No bundle upload on refresh — prevents false key change alerts
		expect(uploadMock2.mock.calls.length).toBe(callsBefore);
	});

	it('calls replenishPreKeysIfNeeded on existing keys', async () => {
		const { SignalProtocolStore } = await import('./store');
		const { generateIdentityAndKeys, generateSigningKey } = await import('./keys');
		const { api } = await import('$lib/api');

		// Make getKeyCount return low count to trigger replenish
		(api.getKeyCount as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ count: 5 });

		const userId = `replenish-${Math.random()}`;
		const preStore = new SignalProtocolStore(userId);
		await preStore.open();
		await generateIdentityAndKeys(preStore);
		await generateSigningKey(preStore);

		const { initCrypto } = await import('./index');
		await initCrypto(userId);

		// getKeyCount should have been called (by replenishPreKeysIfNeeded)
		expect(api.getKeyCount).toHaveBeenCalled();
	});
});

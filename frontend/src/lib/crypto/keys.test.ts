import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalProtocolStore } from './store';
import {
	arrayBufferToBase64,
	base64ToArrayBuffer,
	generateIdentityAndKeys,
	generateSigningKey,
	getSigningPublicKey,
	uploadKeyBundle,
	replenishPreKeysIfNeeded
} from './keys';

// Mock the api module to prevent network calls
const mockUploadKeyBundle = vi.fn().mockResolvedValue(undefined);
const mockGetKeyCount = vi.fn().mockResolvedValue({ count: 100 });

vi.mock('$lib/api', () => ({
	api: {
		uploadKeyBundle: (...args: any[]) => mockUploadKeyBundle(...args),
		getKeyCount: (...args: any[]) => mockGetKeyCount(...args)
	}
}));

describe('base64 helpers', () => {
	it('roundtrips arbitrary data', () => {
		const original = new Uint8Array([0, 1, 127, 128, 255]);
		const b64 = arrayBufferToBase64(original.buffer);
		const result = new Uint8Array(base64ToArrayBuffer(b64));
		expect(result).toEqual(original);
	});

	it('roundtrips empty buffer', () => {
		const empty = new Uint8Array([]);
		const b64 = arrayBufferToBase64(empty.buffer);
		const result = new Uint8Array(base64ToArrayBuffer(b64));
		expect(result).toEqual(empty);
	});
});

describe('generateIdentityAndKeys', () => {
	let store: SignalProtocolStore;

	beforeEach(async () => {
		store = new SignalProtocolStore(`test-keygen-${Math.random()}`);
		await store.open();
	});

	it('generates identity, signed prekey, and 100 OPKs', async () => {
		const result = await generateIdentityAndKeys(store);

		// Identity pub key is base64 string
		expect(typeof result.identityKeyPub).toBe('string');
		expect(result.identityKeyPub.length).toBeGreaterThan(0);

		// Signed prekey has id, publicKey, signature
		expect(result.signedPreKey.keyId).toBe(1);
		expect(result.signedPreKey.publicKey).toBeInstanceOf(ArrayBuffer);
		expect(result.signedPreKey.signature).toBeInstanceOf(ArrayBuffer);

		// 100 one-time prekeys with sequential IDs
		expect(result.oneTimePreKeys).toHaveLength(100);
		expect(result.oneTimePreKeys[0].key_id).toBe(1);
		expect(result.oneTimePreKeys[99].key_id).toBe(100);
		for (const opk of result.oneTimePreKeys) {
			expect(typeof opk.public_key).toBe('string');
		}

		// Keys persisted in store
		const idKey = await store.getIdentityKeyPair();
		expect(idKey).toBeDefined();
		expect(await store.getLocalRegistrationId()).toBeDefined();
		expect(await store.loadSignedPreKey(1)).toBeDefined();
		expect(await store.loadPreKey(1)).toBeDefined();
		expect(await store.getNextPreKeyId()).toBe(101);
		expect(await store.getNextSignedPreKeyId()).toBe(2);
	});
});

describe('generateSigningKey', () => {
	let store: SignalProtocolStore;

	beforeEach(async () => {
		store = new SignalProtocolStore(`test-signing-${Math.random()}`);
		await store.open();
	});

	it('produces Ed25519 keypair and stores it', async () => {
		const pubKeyBase64 = await generateSigningKey(store);
		expect(typeof pubKeyBase64).toBe('string');
		expect(pubKeyBase64.length).toBeGreaterThan(0);

		const retrievedPub = await getSigningPublicKey(store);
		expect(retrievedPub).toBe(pubKeyBase64);
	});

	it('returns null when no signing key set', async () => {
		expect(await getSigningPublicKey(store)).toBeNull();
	});

	it('generates different keys each time', async () => {
		const store2 = new SignalProtocolStore(`test-signing2-${Math.random()}`);
		await store2.open();
		const pub1 = await generateSigningKey(store);
		const pub2 = await generateSigningKey(store2);
		expect(pub1).not.toBe(pub2);
	});
});

describe('uploadKeyBundle', () => {
	beforeEach(() => {
		mockUploadKeyBundle.mockClear();
	});

	it('generates keys and uploads full bundle including signing key', async () => {
		const store = new SignalProtocolStore(`test-upload-${Math.random()}`);
		await store.open();

		await uploadKeyBundle(store);

		expect(mockUploadKeyBundle).toHaveBeenCalledTimes(1);
		const bundle = mockUploadKeyBundle.mock.calls[0][0];
		expect(bundle.identity_key).toBeTruthy();
		expect(bundle.signed_prekey).toBeTruthy();
		expect(bundle.signed_prekey_signature).toBeTruthy();
		expect(typeof bundle.signed_prekey_id).toBe('number');
		expect(bundle.one_time_prekeys).toHaveLength(100);
		expect(bundle.signing_key).toBeTruthy();
	});

	it('stores keys locally before uploading', async () => {
		const store = new SignalProtocolStore(`test-upload2-${Math.random()}`);
		await store.open();

		await uploadKeyBundle(store);

		expect(await store.getIdentityKeyPair()).toBeDefined();
		expect(await store.getLocalRegistrationId()).toBeDefined();
		expect(await store.getSigningKeyPair()).toBeDefined();
	});
});

describe('replenishPreKeysIfNeeded', () => {
	beforeEach(() => {
		mockUploadKeyBundle.mockClear();
		mockGetKeyCount.mockClear();
	});

	it('does nothing when server has enough keys', async () => {
		mockGetKeyCount.mockResolvedValueOnce({ count: 50 });
		const store = new SignalProtocolStore(`test-replenish1-${Math.random()}`);
		await store.open();
		await generateIdentityAndKeys(store);

		await replenishPreKeysIfNeeded(store);

		expect(mockUploadKeyBundle).not.toHaveBeenCalled();
	});

	it('generates new prekeys when below default threshold (20)', async () => {
		mockGetKeyCount.mockResolvedValueOnce({ count: 5 });
		const store = new SignalProtocolStore(`test-replenish2-${Math.random()}`);
		await store.open();
		await generateIdentityAndKeys(store);

		const beforeId = await store.getNextPreKeyId();
		await replenishPreKeysIfNeeded(store);

		expect(mockUploadKeyBundle).toHaveBeenCalledTimes(1);
		const bundle = mockUploadKeyBundle.mock.calls[0][0];
		expect(bundle.one_time_prekeys).toHaveLength(95); // 100 - 5

		const afterId = await store.getNextPreKeyId();
		expect(afterId).toBe(beforeId + 95);
	});

	it('respects custom threshold', async () => {
		mockGetKeyCount.mockResolvedValueOnce({ count: 30 });
		const store = new SignalProtocolStore(`test-replenish3-${Math.random()}`);
		await store.open();
		await generateIdentityAndKeys(store);

		await replenishPreKeysIfNeeded(store, 50);

		expect(mockUploadKeyBundle).toHaveBeenCalledTimes(1);
		expect(mockUploadKeyBundle.mock.calls[0][0].one_time_prekeys).toHaveLength(70);
	});

	it('handles API errors gracefully', async () => {
		mockGetKeyCount.mockRejectedValueOnce(new Error('network error'));
		const store = new SignalProtocolStore(`test-replenish4-${Math.random()}`);
		await store.open();
		await generateIdentityAndKeys(store);

		// Should not throw
		await replenishPreKeysIfNeeded(store);
		expect(mockUploadKeyBundle).not.toHaveBeenCalled();
	});

	it('does nothing if no identity key pair exists', async () => {
		mockGetKeyCount.mockResolvedValueOnce({ count: 0 });
		const store = new SignalProtocolStore(`test-replenish5-${Math.random()}`);
		await store.open();
		// No keys generated

		await replenishPreKeysIfNeeded(store);
		expect(mockUploadKeyBundle).not.toHaveBeenCalled();
	});
});

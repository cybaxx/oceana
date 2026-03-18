import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalProtocolStore } from './store';
import {
	arrayBufferToBase64,
	base64ToArrayBuffer,
	generateIdentityAndKeys,
	generateSigningKey,
	getSigningPublicKey
} from './keys';

// Mock the api module to prevent network calls
vi.mock('$lib/api', () => ({
	api: {
		uploadKeyBundle: vi.fn(),
		getKeyCount: vi.fn()
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
});

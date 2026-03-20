import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalProtocolStore } from './store';
import { generateIdentityAndKeys, arrayBufferToBase64 } from './keys';
import { initSession, encryptMessage, decryptMessage } from './signal';
import { generateSafetyNumber, formatSafetyNumber } from './fingerprint';
import type { PreKeyBundleResponse } from '$lib/types';

vi.mock('$lib/api', () => ({
	api: {
		uploadKeyBundle: vi.fn(),
		getKeyCount: vi.fn()
	}
}));

describe('Safety Numbers', () => {
	let aliceStore: SignalProtocolStore;
	let bobStore: SignalProtocolStore;

	beforeEach(async () => {
		aliceStore = new SignalProtocolStore(`alice-fp-${Math.random()}`);
		await aliceStore.open();
		const aliceKeys = await generateIdentityAndKeys(aliceStore);

		bobStore = new SignalProtocolStore(`bob-fp-${Math.random()}`);
		await bobStore.open();
		const bobKeys = await generateIdentityAndKeys(bobStore);

		// Alice initiates session with Bob so identity keys are stored
		const bobBundle: PreKeyBundleResponse = {
			user_id: 'bob',
			identity_key: bobKeys.identityKeyPub,
			signed_prekey: arrayBufferToBase64(bobKeys.signedPreKey.publicKey),
			signed_prekey_signature: arrayBufferToBase64(bobKeys.signedPreKey.signature),
			signed_prekey_id: bobKeys.signedPreKey.keyId,
			one_time_prekey: bobKeys.oneTimePreKeys[0]
		};
		await initSession(aliceStore, 'bob', bobBundle);

		// Bob initiates session with Alice
		const aliceBundle: PreKeyBundleResponse = {
			user_id: 'alice',
			identity_key: aliceKeys.identityKeyPub,
			signed_prekey: arrayBufferToBase64(aliceKeys.signedPreKey.publicKey),
			signed_prekey_signature: arrayBufferToBase64(aliceKeys.signedPreKey.signature),
			signed_prekey_id: aliceKeys.signedPreKey.keyId,
			one_time_prekey: aliceKeys.oneTimePreKeys[0]
		};
		await initSession(bobStore, 'alice', aliceBundle);
	});

	it('generates a safety number string', async () => {
		const sn = await generateSafetyNumber(aliceStore, 'alice', 'bob');
		expect(typeof sn).toBe('string');
		expect(sn.length).toBeGreaterThan(0);
		// Should be all digits
		expect(sn).toMatch(/^\d+$/);
	});

	it('both sides produce the same safety number', async () => {
		const aliceSN = await generateSafetyNumber(aliceStore, 'alice', 'bob');
		const bobSN = await generateSafetyNumber(bobStore, 'bob', 'alice');
		expect(aliceSN).toBe(bobSN);
	});

	it('throws if no session exists for contact', async () => {
		await expect(
			generateSafetyNumber(aliceStore, 'alice', 'unknown-user')
		).rejects.toThrow('No identity key for contact');
	});

	it('identity key bytes match between getIdentityKeyPair and loadIdentityKey', async () => {
		// Verify that Alice's pubKey as seen by Alice matches what Bob stored
		const alicePubKey = (await aliceStore.getIdentityKeyPair())!.pubKey;
		const aliceKeyAtBob = await bobStore.loadIdentityKey('alice.1');

		expect(aliceKeyAtBob).toBeDefined();
		const a = new Uint8Array(alicePubKey);
		const b = new Uint8Array(aliceKeyAtBob!);
		expect(a.length).toBe(b.length);
		expect(arrayBufferToBase64(alicePubKey)).toBe(arrayBufferToBase64(aliceKeyAtBob!));

		// And vice versa
		const bobPubKey = (await bobStore.getIdentityKeyPair())!.pubKey;
		const bobKeyAtAlice = await aliceStore.loadIdentityKey('bob.1');
		expect(arrayBufferToBase64(bobPubKey)).toBe(arrayBufferToBase64(bobKeyAtAlice!));
	});

	it('matches when only one side called initSession (realistic message flow)', async () => {
		// Simulate real flow: Alice initiates session and sends, Bob receives and decrypts
		const aStore = new SignalProtocolStore(`alice-real-${Math.random()}`);
		await aStore.open();
		const aKeys = await generateIdentityAndKeys(aStore);

		const bStore = new SignalProtocolStore(`bob-real-${Math.random()}`);
		await bStore.open();
		const bKeys = await generateIdentityAndKeys(bStore);

		// Only Alice inits session with Bob (fetches Bob's bundle)
		const bBundle: PreKeyBundleResponse = {
			user_id: 'bob-uuid',
			identity_key: bKeys.identityKeyPub,
			signed_prekey: arrayBufferToBase64(bKeys.signedPreKey.publicKey),
			signed_prekey_signature: arrayBufferToBase64(bKeys.signedPreKey.signature),
			signed_prekey_id: bKeys.signedPreKey.keyId,
			one_time_prekey: bKeys.oneTimePreKeys[0]
		};
		await initSession(aStore, 'bob-uuid', bBundle);

		// Alice encrypts a message
		const { ciphertext, messageType } = await encryptMessage(aStore, 'bob-uuid', 'hello bob');

		// Bob decrypts — this stores Alice's identity key via processPreKey
		const plaintext = await decryptMessage(bStore, 'alice-uuid', ciphertext, messageType);
		expect(plaintext).toBe('hello bob');

		// Now both sides generate safety numbers
		const aliceSN = await generateSafetyNumber(aStore, 'alice-uuid', 'bob-uuid');
		const bobSN = await generateSafetyNumber(bStore, 'bob-uuid', 'alice-uuid');
		expect(aliceSN).toBe(bobSN);
	});

	it('matches with UUID-style identifiers', async () => {
		const aId = '550e8400-e29b-41d4-a716-446655440000';
		const bId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

		const aStore = new SignalProtocolStore(`uuid-a-${Math.random()}`);
		await aStore.open();
		const aKeys = await generateIdentityAndKeys(aStore);

		const bStore = new SignalProtocolStore(`uuid-b-${Math.random()}`);
		await bStore.open();
		const bKeys = await generateIdentityAndKeys(bStore);

		const bBundle: PreKeyBundleResponse = {
			user_id: bId,
			identity_key: bKeys.identityKeyPub,
			signed_prekey: arrayBufferToBase64(bKeys.signedPreKey.publicKey),
			signed_prekey_signature: arrayBufferToBase64(bKeys.signedPreKey.signature),
			signed_prekey_id: bKeys.signedPreKey.keyId,
			one_time_prekey: bKeys.oneTimePreKeys[0]
		};
		await initSession(aStore, bId, bBundle);

		const aBundle: PreKeyBundleResponse = {
			user_id: aId,
			identity_key: aKeys.identityKeyPub,
			signed_prekey: arrayBufferToBase64(aKeys.signedPreKey.publicKey),
			signed_prekey_signature: arrayBufferToBase64(aKeys.signedPreKey.signature),
			signed_prekey_id: aKeys.signedPreKey.keyId,
			one_time_prekey: aKeys.oneTimePreKeys[0]
		};
		await initSession(bStore, aId, aBundle);

		const aSN = await generateSafetyNumber(aStore, aId, bId);
		const bSN = await generateSafetyNumber(bStore, bId, aId);
		expect(aSN).toBe(bSN);
	});
});

describe('formatSafetyNumber', () => {
	it('formats into groups of 5', () => {
		const raw = '123456789012345';
		expect(formatSafetyNumber(raw)).toBe('12345 67890 12345');
	});

	it('handles partial last group', () => {
		const raw = '1234567';
		expect(formatSafetyNumber(raw)).toBe('12345 67');
	});

	it('handles empty string', () => {
		expect(formatSafetyNumber('')).toBe('');
	});
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalProtocolStore } from './store';
import {
	generateIdentityAndKeys,
	generateSigningKey,
	arrayBufferToBase64,
	base64ToArrayBuffer
} from './keys';
import {
	signContent,
	verifySignature,
	initSession,
	encryptMessage,
	decryptMessage
} from './signal';
import type { PreKeyBundleResponse } from '$lib/types';

vi.mock('$lib/api', () => ({
	api: {
		uploadKeyBundle: vi.fn(),
		getKeyCount: vi.fn()
	}
}));

describe('Ed25519 signing', () => {
	let store: SignalProtocolStore;

	beforeEach(async () => {
		store = new SignalProtocolStore(`test-sign-${Math.random()}`);
		await store.open();
		await generateSigningKey(store);
	});

	it('sign and verify roundtrip', async () => {
		const sig = await signContent(store, 'hello world');
		const pubKey = (await store.getSigningKeyPair())!.publicKey;
		const pubKeyBase64 = arrayBufferToBase64(await crypto.subtle.exportKey('raw', pubKey));
		expect(await verifySignature(pubKeyBase64, 'hello world', sig)).toBe(true);
	});

	it('wrong content fails verification', async () => {
		const sig = await signContent(store, 'hello world');
		const pubKey = (await store.getSigningKeyPair())!.publicKey;
		const pubKeyBase64 = arrayBufferToBase64(await crypto.subtle.exportKey('raw', pubKey));
		expect(await verifySignature(pubKeyBase64, 'wrong content', sig)).toBe(false);
	});

	it('wrong key fails verification', async () => {
		const sig = await signContent(store, 'hello world');
		const otherStore = new SignalProtocolStore(`test-sign-other-${Math.random()}`);
		await otherStore.open();
		const otherPubBase64 = await generateSigningKey(otherStore);
		expect(await verifySignature(otherPubBase64, 'hello world', sig)).toBe(false);
	});

	it('unicode content signs and verifies', async () => {
		const content = '🔐 Héllo wörld! 你好世界';
		const sig = await signContent(store, content);
		const pubKey = (await store.getSigningKeyPair())!.publicKey;
		const pubKeyBase64 = arrayBufferToBase64(await crypto.subtle.exportKey('raw', pubKey));
		expect(await verifySignature(pubKeyBase64, content, sig)).toBe(true);
	});
});

describe('Signal Protocol encrypt/decrypt', () => {
	it('full roundtrip: Alice encrypts, Bob decrypts', async () => {
		// Setup Alice
		const aliceStore = new SignalProtocolStore(`alice-${Math.random()}`);
		await aliceStore.open();
		const aliceKeys = await generateIdentityAndKeys(aliceStore);

		// Setup Bob
		const bobStore = new SignalProtocolStore(`bob-${Math.random()}`);
		await bobStore.open();
		const bobKeys = await generateIdentityAndKeys(bobStore);

		// Build a PreKeyBundleResponse from Bob's keys
		const bobBundle: PreKeyBundleResponse = {
			user_id: 'bob',
			identity_key: bobKeys.identityKeyPub,
			signed_prekey: arrayBufferToBase64(bobKeys.signedPreKey.publicKey),
			signed_prekey_signature: arrayBufferToBase64(bobKeys.signedPreKey.signature),
			signed_prekey_id: bobKeys.signedPreKey.keyId,
			one_time_prekey: bobKeys.oneTimePreKeys[0]
		};

		// Alice initiates session with Bob's bundle
		await initSession(aliceStore, 'bob', bobBundle);

		// Alice encrypts
		const plaintext = 'Hello Bob, this is a secret message!';
		const { ciphertext, messageType } = await encryptMessage(aliceStore, 'bob', plaintext);

		// First message should be PreKeyWhisperMessage (type 3)
		expect(messageType).toBe(3);

		// Ciphertext should differ from plaintext
		const ciphertextBytes = base64ToArrayBuffer(ciphertext);
		const plaintextBytes = new TextEncoder().encode(plaintext).buffer;
		expect(new Uint8Array(ciphertextBytes)).not.toEqual(new Uint8Array(plaintextBytes));

		// Bob decrypts
		const decrypted = await decryptMessage(bobStore, 'alice', ciphertext, messageType);
		expect(decrypted).toBe(plaintext);
	});
});

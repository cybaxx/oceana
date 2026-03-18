import { describe, it, expect, beforeEach } from 'vitest';
import { SignalProtocolStore } from './store';

describe('SignalProtocolStore', () => {
	let store: SignalProtocolStore;

	beforeEach(async () => {
		store = new SignalProtocolStore(`test-${Math.random()}`);
		await store.open();
	});

	describe('address', () => {
		it('returns userId.1', () => {
			expect(SignalProtocolStore.address('alice')).toBe('alice.1');
		});
	});

	describe('identity keypair', () => {
		it('stores and retrieves identity keypair', async () => {
			const keyPair = {
				pubKey: new Uint8Array([1, 2, 3]).buffer,
				privKey: new Uint8Array([4, 5, 6]).buffer
			};
			await store.setIdentityKeyPair(keyPair);
			const retrieved = await store.getIdentityKeyPair();
			expect(new Uint8Array(retrieved!.pubKey)).toEqual(new Uint8Array([1, 2, 3]));
			expect(new Uint8Array(retrieved!.privKey)).toEqual(new Uint8Array([4, 5, 6]));
		});

		it('returns undefined when not set', async () => {
			expect(await store.getIdentityKeyPair()).toBeUndefined();
		});
	});

	describe('signing keypair', () => {
		it('stores and retrieves CryptoKeyPair', async () => {
			const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
			await store.setSigningKeyPair(keyPair as CryptoKeyPair);
			const retrieved = await store.getSigningKeyPair();
			expect(retrieved).toBeDefined();
			const sig = await crypto.subtle.sign('Ed25519', retrieved!.privateKey, new Uint8Array([1]));
			const ok = await crypto.subtle.verify(
				'Ed25519',
				retrieved!.publicKey,
				sig,
				new Uint8Array([1])
			);
			expect(ok).toBe(true);
		});
	});

	describe('registration ID', () => {
		it('stores and retrieves', async () => {
			await store.setLocalRegistrationId(42);
			expect(await store.getLocalRegistrationId()).toBe(42);
		});

		it('returns undefined when not set', async () => {
			expect(await store.getLocalRegistrationId()).toBeUndefined();
		});
	});

	describe('prekeys', () => {
		it('stores, loads, and removes', async () => {
			const kp = {
				pubKey: new Uint8Array([10]).buffer,
				privKey: new Uint8Array([20]).buffer
			};
			await store.storePreKey(1, kp);
			const loaded = await store.loadPreKey(1);
			expect(new Uint8Array(loaded!.pubKey)).toEqual(new Uint8Array([10]));

			await store.removePreKey(1);
			expect(await store.loadPreKey(1)).toBeUndefined();
		});
	});

	describe('signed prekeys', () => {
		it('stores, loads, and removes', async () => {
			const kp = {
				pubKey: new Uint8Array([30]).buffer,
				privKey: new Uint8Array([40]).buffer
			};
			await store.storeSignedPreKey(1, kp);
			const loaded = await store.loadSignedPreKey(1);
			expect(new Uint8Array(loaded!.pubKey)).toEqual(new Uint8Array([30]));

			await store.removeSignedPreKey(1);
			expect(await store.loadSignedPreKey(1)).toBeUndefined();
		});
	});

	describe('sessions', () => {
		it('stores and loads', async () => {
			await store.storeSession('alice.1', { record: 'data' });
			const loaded = await store.loadSession('alice.1');
			expect(loaded).toEqual({ record: 'data' });
		});

		it('returns undefined for missing session', async () => {
			expect(await store.loadSession('nobody.1')).toBeUndefined();
		});
	});

	describe('TOFU identity trust', () => {
		it('trusts first key', async () => {
			const key = new Uint8Array([1, 2, 3]).buffer;
			expect(await store.isTrustedIdentity('bob', key, 0)).toBe(true);
		});

		it('trusts same key', async () => {
			const key = new Uint8Array([1, 2, 3]).buffer;
			await store.saveIdentity('bob', key);
			expect(await store.isTrustedIdentity('bob', new Uint8Array([1, 2, 3]).buffer, 0)).toBe(
				true
			);
		});

		it('rejects different key', async () => {
			await store.saveIdentity('bob', new Uint8Array([1, 2, 3]).buffer);
			expect(await store.isTrustedIdentity('bob', new Uint8Array([4, 5, 6]).buffer, 0)).toBe(
				false
			);
		});
	});

	describe('saveIdentity', () => {
		it('returns false on first save', async () => {
			expect(await store.saveIdentity('bob', new Uint8Array([1]).buffer)).toBe(false);
		});

		it('returns false when saving same key', async () => {
			await store.saveIdentity('bob', new Uint8Array([1]).buffer);
			expect(await store.saveIdentity('bob', new Uint8Array([1]).buffer)).toBe(false);
		});

		it('returns true when key changes', async () => {
			await store.saveIdentity('bob', new Uint8Array([1]).buffer);
			expect(await store.saveIdentity('bob', new Uint8Array([2]).buffer)).toBe(true);
		});
	});

	describe('next ID tracking', () => {
		it('defaults to 1', async () => {
			expect(await store.getNextPreKeyId()).toBe(1);
			expect(await store.getNextSignedPreKeyId()).toBe(1);
		});

		it('increments correctly', async () => {
			await store.setNextPreKeyId(5);
			expect(await store.getNextPreKeyId()).toBe(5);
			await store.setNextSignedPreKeyId(10);
			expect(await store.getNextSignedPreKeyId()).toBe(10);
		});
	});
});

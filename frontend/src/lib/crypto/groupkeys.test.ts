import { describe, it, expect } from 'vitest';
import {
	generateGroupKey,
	exportGroupKey,
	importGroupKey,
	encryptGroupMessage,
	decryptGroupMessage
} from './groupkeys';

describe('Group Key Management', () => {
	it('generates an AES-256-GCM key', async () => {
		const key = await generateGroupKey();
		expect(key.type).toBe('secret');
		expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
		expect(key.extractable).toBe(true);
	});

	it('export and import roundtrip', async () => {
		const key = await generateGroupKey();
		const exported = await exportGroupKey(key);
		expect(typeof exported).toBe('string');

		const imported = await importGroupKey(exported);
		// Verify by re-exporting
		const reExported = await exportGroupKey(imported);
		expect(reExported).toBe(exported);
	});

	it('encrypt and decrypt roundtrip', async () => {
		const key = await generateGroupKey();
		const plaintext = 'Hello group chat!';
		const { ciphertext, nonce } = await encryptGroupMessage(key, plaintext);

		expect(ciphertext).not.toBe(plaintext);
		expect(nonce.length).toBeGreaterThan(0);

		const decrypted = await decryptGroupMessage(key, ciphertext, nonce);
		expect(decrypted).toBe(plaintext);
	});

	it('unicode content roundtrip', async () => {
		const key = await generateGroupKey();
		const plaintext = '🔐 Héllo wörld! 你好世界';
		const { ciphertext, nonce } = await encryptGroupMessage(key, plaintext);
		const decrypted = await decryptGroupMessage(key, ciphertext, nonce);
		expect(decrypted).toBe(plaintext);
	});

	it('different nonce per encryption', async () => {
		const key = await generateGroupKey();
		const r1 = await encryptGroupMessage(key, 'same text');
		const r2 = await encryptGroupMessage(key, 'same text');
		expect(r1.nonce).not.toBe(r2.nonce);
		expect(r1.ciphertext).not.toBe(r2.ciphertext);
	});

	it('wrong key fails decryption', async () => {
		const key1 = await generateGroupKey();
		const key2 = await generateGroupKey();
		const { ciphertext, nonce } = await encryptGroupMessage(key1, 'secret');
		await expect(decryptGroupMessage(key2, ciphertext, nonce)).rejects.toThrow();
	});

	it('tampered ciphertext fails decryption', async () => {
		const key = await generateGroupKey();
		const { ciphertext, nonce } = await encryptGroupMessage(key, 'secret');
		// Flip a character in the base64
		const tampered = ciphertext.slice(0, -2) + 'XX';
		await expect(decryptGroupMessage(key, tampered, nonce)).rejects.toThrow();
	});
});

describe('Group Key Store Integration', () => {
	it('store and load group key via SignalProtocolStore', async () => {
		const { SignalProtocolStore } = await import('./store');
		const store = new SignalProtocolStore(`group-test-${Math.random()}`);
		await store.open();

		const key = await generateGroupKey();
		await store.storeGroupKey('conv-123', key);

		const loaded = await store.loadGroupKey('conv-123');
		expect(loaded).toBeDefined();

		// Verify it's the same key
		const originalExport = await exportGroupKey(key);
		const loadedExport = await exportGroupKey(loaded!);
		expect(loadedExport).toBe(originalExport);
	});

	it('returns undefined for unknown group', async () => {
		const { SignalProtocolStore } = await import('./store');
		const store = new SignalProtocolStore(`group-test-${Math.random()}`);
		await store.open();

		const loaded = await store.loadGroupKey('nonexistent');
		expect(loaded).toBeUndefined();
	});
});

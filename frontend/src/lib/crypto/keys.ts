import {
	KeyHelper,
	type SignedPublicPreKeyType
} from '@privacyresearch/libsignal-protocol-typescript';
import type { SignalProtocolStore } from './store';
import { api } from '$lib/api';

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

export async function generateIdentityAndKeys(store: SignalProtocolStore): Promise<{
	identityKeyPub: string;
	signedPreKey: SignedPublicPreKeyType;
	signedPreKeySignature: string;
	oneTimePreKeys: { key_id: number; public_key: string }[];
}> {
	const registrationId = KeyHelper.generateRegistrationId();
	await store.setLocalRegistrationId(registrationId);

	const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
	await store.setIdentityKeyPair(identityKeyPair);

	const signedPreKeyId = await store.getNextSignedPreKeyId();
	const signedPreKey = await KeyHelper.generateSignedPreKey(identityKeyPair, signedPreKeyId);
	await store.storeSignedPreKey(signedPreKeyId, signedPreKey.keyPair);
	await store.setNextSignedPreKeyId(signedPreKeyId + 1);

	// Generate 100 one-time prekeys
	const startId = await store.getNextPreKeyId();
	const oneTimePreKeys: { key_id: number; public_key: string }[] = [];
	for (let i = 0; i < 100; i++) {
		const keyId = startId + i;
		const preKey = await KeyHelper.generatePreKey(keyId);
		await store.storePreKey(keyId, preKey.keyPair);
		oneTimePreKeys.push({
			key_id: keyId,
			public_key: arrayBufferToBase64(preKey.keyPair.pubKey)
		});
	}
	await store.setNextPreKeyId(startId + 100);

	return {
		identityKeyPub: arrayBufferToBase64(identityKeyPair.pubKey),
		signedPreKey: {
			keyId: signedPreKeyId,
			publicKey: signedPreKey.keyPair.pubKey,
			signature: signedPreKey.signature
		},
		signedPreKeySignature: arrayBufferToBase64(signedPreKey.signature),
		oneTimePreKeys
	};
}

export async function generateSigningKey(store: SignalProtocolStore): Promise<string> {
	const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
	await store.setSigningKeyPair(keyPair as CryptoKeyPair);
	const rawPub = await crypto.subtle.exportKey('raw', (keyPair as CryptoKeyPair).publicKey);
	return arrayBufferToBase64(rawPub);
}

export async function getSigningPublicKey(store: SignalProtocolStore): Promise<string | null> {
	const keyPair = await store.getSigningKeyPair();
	if (!keyPair) return null;
	const rawPub = await crypto.subtle.exportKey('raw', keyPair.publicKey);
	return arrayBufferToBase64(rawPub);
}

export async function uploadKeyBundle(store: SignalProtocolStore): Promise<void> {
	const keys = await generateIdentityAndKeys(store);
	const signingPub = await generateSigningKey(store);
	await api.uploadKeyBundle({
		identity_key: keys.identityKeyPub,
		signed_prekey: arrayBufferToBase64(keys.signedPreKey.publicKey),
		signed_prekey_signature: keys.signedPreKeySignature,
		signed_prekey_id: keys.signedPreKey.keyId,
		one_time_prekeys: keys.oneTimePreKeys,
		signing_key: signingPub
	});
}

export async function replenishPreKeysIfNeeded(store: SignalProtocolStore, threshold = 20): Promise<void> {
	try {
		const { count } = (await api.getKeyCount()) as { count: number };
		if (count >= threshold) return;

		const identityKeyPair = await store.getIdentityKeyPair();
		if (!identityKeyPair) return;

		const startId = await store.getNextPreKeyId();
		const newKeys: { key_id: number; public_key: string }[] = [];
		const batchSize = 100 - count;

		for (let i = 0; i < batchSize; i++) {
			const keyId = startId + i;
			const preKey = await KeyHelper.generatePreKey(keyId);
			await store.storePreKey(keyId, preKey.keyPair);
			newKeys.push({
				key_id: keyId,
				public_key: arrayBufferToBase64(preKey.keyPair.pubKey)
			});
		}
		await store.setNextPreKeyId(startId + batchSize);

		// Upload just the new OPKs (re-upload full bundle with existing identity)
		const signedPreKeyId = (await store.getNextSignedPreKeyId()) - 1;
		const signedPreKey = await store.loadSignedPreKey(signedPreKeyId);
		if (!signedPreKey) return;

		// We need the signature — regenerate signed prekey or just upload new OPKs
		// For simplicity, do a full bundle re-upload
		await api.uploadKeyBundle({
			identity_key: arrayBufferToBase64(identityKeyPair.pubKey),
			signed_prekey: arrayBufferToBase64(signedPreKey.pubKey),
			signed_prekey_signature: '', // server will keep existing if empty
			signed_prekey_id: signedPreKeyId,
			one_time_prekeys: newKeys
		});
	} catch (e) {
		console.error('Failed to replenish prekeys:', e);
	}
}

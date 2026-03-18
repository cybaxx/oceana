import {
	SessionBuilder,
	SessionCipher,
	SignalProtocolAddress,
	type PreKeyType,
	type SignedPublicPreKeyType
} from '@privacyresearch/libsignal-protocol-typescript';
import type { SignalProtocolStore } from './store';
import { arrayBufferToBase64, base64ToArrayBuffer } from './keys';
import type { PreKeyBundleResponse } from '$lib/types';

export async function initSession(
	store: SignalProtocolStore,
	recipientUserId: string,
	bundle: PreKeyBundleResponse
): Promise<void> {
	const address = new SignalProtocolAddress(recipientUserId, 1);
	const builder = new SessionBuilder(store as any, address);

	const preKey: PreKeyType | undefined = bundle.one_time_prekey
		? {
				keyId: bundle.one_time_prekey.key_id,
				publicKey: base64ToArrayBuffer(bundle.one_time_prekey.public_key)
			}
		: undefined;

	const signedPreKey: SignedPublicPreKeyType = {
		keyId: bundle.signed_prekey_id,
		publicKey: base64ToArrayBuffer(bundle.signed_prekey),
		signature: base64ToArrayBuffer(bundle.signed_prekey_signature)
	};

	await builder.processPreKey({
		registrationId: 0, // not used for remote
		identityKey: base64ToArrayBuffer(bundle.identity_key),
		signedPreKey,
		preKey
	});
}

export async function encryptMessage(
	store: SignalProtocolStore,
	recipientUserId: string,
	plaintext: string
): Promise<{ ciphertext: string; messageType: number }> {
	const address = new SignalProtocolAddress(recipientUserId, 1);
	const cipher = new SessionCipher(store as any, address);
	const encrypted = await cipher.encrypt(new TextEncoder().encode(plaintext).buffer);
	return {
		ciphertext: arrayBufferToBase64(
			typeof encrypted.body === 'string'
				? Uint8Array.from(encrypted.body, (c) => c.charCodeAt(0)).buffer
				: encrypted.body!
		),
		messageType: encrypted.type
	};
}

export async function decryptMessage(
	store: SignalProtocolStore,
	senderUserId: string,
	ciphertext: string,
	messageType: number
): Promise<string> {
	const address = new SignalProtocolAddress(senderUserId, 1);
	const cipher = new SessionCipher(store as any, address);
	const ciphertextBuf = base64ToArrayBuffer(ciphertext);

	let plainBuf: ArrayBuffer;
	if (messageType === 3) {
		// PreKeyWhisperMessage
		plainBuf = await cipher.decryptPreKeyWhisperMessage(ciphertextBuf, 'binary');
	} else {
		// WhisperMessage
		plainBuf = await cipher.decryptWhisperMessage(ciphertextBuf, 'binary');
	}
	return new TextDecoder().decode(plainBuf);
}

export async function signContent(
	store: SignalProtocolStore,
	content: string
): Promise<string> {
	const keyPair = await store.getSigningKeyPair();
	if (!keyPair) throw new Error('No signing key');

	const data = new TextEncoder().encode(content);
	const signature = await crypto.subtle.sign('Ed25519', keyPair.privateKey, data);
	return arrayBufferToBase64(signature);
}

export async function verifySignature(
	signingKeyBase64: string,
	content: string,
	signatureBase64: string
): Promise<boolean> {
	try {
		const pubKeyBuf = base64ToArrayBuffer(signingKeyBase64);
		const key = await crypto.subtle.importKey(
			'raw',
			pubKeyBuf,
			{ name: 'Ed25519' },
			false,
			['verify']
		);
		const data = new TextEncoder().encode(content);
		const signature = base64ToArrayBuffer(signatureBase64);
		return await crypto.subtle.verify('Ed25519', key, signature, data);
	} catch {
		return false;
	}
}

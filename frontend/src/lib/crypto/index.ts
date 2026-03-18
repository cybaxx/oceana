import { SignalProtocolStore } from './store';
import { uploadKeyBundle, replenishPreKeysIfNeeded, generateSigningKey, getSigningPublicKey } from './keys';
import { api } from '$lib/api';

let store: SignalProtocolStore | null = null;
let initPromise: Promise<void> | null = null;

export async function initCrypto(userId: string): Promise<void> {
	if (store) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		const s = new SignalProtocolStore(userId);
		await s.open();

		// Check if we already have keys
		const existing = await s.getIdentityKeyPair();
		if (!existing) {
			// First time — generate and upload (includes signing key)
			await uploadKeyBundle(s);
		} else {
			// Ensure signing key exists (upgrade path for existing users)
			const signingKey = await s.getSigningKeyPair();
			if (!signingKey) {
				const signingPub = await generateSigningKey(s);
				// Upload just the signing key via a bundle update
				const { arrayBufferToBase64 } = await import('./keys');
				const identityPub = arrayBufferToBase64(existing.pubKey);
				const signedPreKeyId = (await s.getNextSignedPreKeyId()) - 1;
				const signedPreKey = await s.loadSignedPreKey(signedPreKeyId);
				if (signedPreKey) {
					await api.uploadKeyBundle({
						identity_key: identityPub,
						signed_prekey: arrayBufferToBase64(signedPreKey.pubKey),
						signed_prekey_signature: '',
						signed_prekey_id: signedPreKeyId,
						one_time_prekeys: [],
						signing_key: signingPub
					});
				}
			}
			// Replenish OPKs if needed
			await replenishPreKeysIfNeeded(s);
		}

		store = s;
	})();

	return initPromise;
}

export function getCryptoStore(): SignalProtocolStore | null {
	return store;
}

export { SignalProtocolStore } from './store';
export { encryptMessage, decryptMessage, signContent, verifySignature, initSession } from './signal';
export { arrayBufferToBase64, base64ToArrayBuffer } from './keys';

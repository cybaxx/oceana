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
				// First time generating signing key — upload it once
				const signingPub = await generateSigningKey(s);
				if (signingPub) {
					try {
						const { arrayBufferToBase64 } = await import('./keys');
						const identityPub = arrayBufferToBase64(existing.pubKey);
						const signedPreKeyId = (await s.getNextSignedPreKeyId()) - 1;
						const signedPreKey = await s.loadSignedPreKey(signedPreKeyId);
						await api.uploadKeyBundle({
							identity_key: identityPub,
							signed_prekey: signedPreKey ? arrayBufferToBase64(signedPreKey.pubKey) : '',
							signed_prekey_signature: '',
							signed_prekey_id: signedPreKeyId,
							one_time_prekeys: [],
							signing_key: signingPub
						});
					} catch (e) {
						console.error('Failed to upload signing key:', e);
					}
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

export function clearCryptoStore(): void {
	store = null;
	initPromise = null;
}

export { SignalProtocolStore } from './store';
export { encryptMessage, decryptMessage, signContent, verifySignature, initSession } from './signal';
export { arrayBufferToBase64, base64ToArrayBuffer } from './keys';
export { generateSafetyNumber, formatSafetyNumber } from './fingerprint';

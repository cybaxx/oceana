// AES-256-GCM group key management for group chat E2EE

export async function generateGroupKey(): Promise<CryptoKey> {
	return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
}

export async function exportGroupKey(key: CryptoKey): Promise<string> {
	const raw = await crypto.subtle.exportKey('raw', key);
	return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importGroupKey(b64: string): Promise<CryptoKey> {
	const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
}

export async function encryptGroupMessage(
	key: CryptoKey,
	plaintext: string
): Promise<{ ciphertext: string; nonce: string }> {
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const encoded = new TextEncoder().encode(plaintext);
	const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
	return {
		ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
		nonce: btoa(String.fromCharCode(...iv))
	};
}

export async function decryptGroupMessage(
	key: CryptoKey,
	ciphertext: string,
	nonce: string
): Promise<string> {
	const iv = Uint8Array.from(atob(nonce), (c) => c.charCodeAt(0));
	const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0)).buffer;
	const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
	return new TextDecoder().decode(decrypted);
}

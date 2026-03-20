import { SignalProtocolStore } from './store';

// Number of SHA-512 iterations. Signal uses 5200 but with native crypto.
// The library's FingerprintGenerator uses a slow JS polyfill (msrcrypto),
// so we reimplement using the native Web Crypto API.
const ITERATIONS = 5200;
const VERSION = 0;

export async function generateSafetyNumber(
	store: SignalProtocolStore,
	ourUserId: string,
	theirUserId: string
): Promise<string> {
	const ourKeyPair = await store.getIdentityKeyPair();
	if (!ourKeyPair) throw new Error('No local identity key');

	const theirKey = await store.loadIdentityKey(SignalProtocolStore.address(theirUserId));
	if (!theirKey) throw new Error('No identity key for contact — no session established yet');

	const localStr = await getDisplayStringFor(ourUserId, ourKeyPair.pubKey);
	const remoteStr = await getDisplayStringFor(theirUserId, theirKey);
	return [localStr, remoteStr].sort().join('');
}

async function getDisplayStringFor(identifier: string, key: ArrayBuffer): Promise<string> {
	const idBytes = new TextEncoder().encode(identifier);
	const versionBuf = new Uint16Array([VERSION]).buffer;
	const initial = concatBuffers([versionBuf, key, idBytes]);

	const hash = await iterateHash(initial, key, ITERATIONS);
	const output = new Uint8Array(hash);

	return (
		getEncodedChunk(output, 0) +
		getEncodedChunk(output, 5) +
		getEncodedChunk(output, 10) +
		getEncodedChunk(output, 15) +
		getEncodedChunk(output, 20) +
		getEncodedChunk(output, 25)
	);
}

async function iterateHash(data: ArrayBuffer, key: ArrayBuffer, count: number): Promise<ArrayBuffer> {
	let current = concatBuffers([data, key]);
	for (let i = 0; i < count; i++) {
		current = await crypto.subtle.digest('SHA-512', current);
		if (i < count - 1) {
			current = concatBuffers([current, key]);
		}
	}
	return current;
}

function getEncodedChunk(hash: Uint8Array, offset: number): string {
	const chunk =
		(hash[offset] * 2 ** 32 +
			hash[offset + 1] * 2 ** 24 +
			hash[offset + 2] * 2 ** 16 +
			hash[offset + 3] * 2 ** 8 +
			hash[offset + 4]) %
		100000;
	return chunk.toString().padStart(5, '0');
}

function concatBuffers(bufs: ArrayBuffer[]): ArrayBuffer {
	const totalLength = bufs.reduce((sum, b) => sum + b.byteLength, 0);
	const result = new Uint8Array(totalLength);
	let offset = 0;
	for (const buf of bufs) {
		result.set(new Uint8Array(buf), offset);
		offset += buf.byteLength;
	}
	return result.buffer;
}

export function formatSafetyNumber(raw: string): string {
	const groups: string[] = [];
	for (let i = 0; i < raw.length; i += 5) {
		groups.push(raw.slice(i, i + 5));
	}
	return groups.join(' ');
}

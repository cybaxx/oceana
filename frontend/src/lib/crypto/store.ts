// IndexedDB-backed Signal Protocol store
// Implements the store interfaces needed by @privacyresearch/libsignal-protocol-typescript

const DB_VERSION = 2;

function dbName(userId: string): string {
	return `oceana-keys-${userId}`;
}

function openDB(userId: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(dbName(userId), DB_VERSION);
		request.onupgradeneeded = (event) => {
			const db = request.result;
			if (!db.objectStoreNames.contains('identity')) db.createObjectStore('identity');
			if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions');
			if (!db.objectStoreNames.contains('signedPrekeys')) db.createObjectStore('signedPrekeys');
			if (!db.objectStoreNames.contains('prekeys')) db.createObjectStore('prekeys');
			if (!db.objectStoreNames.contains('identityKeys')) db.createObjectStore('identityKeys');
			if (!db.objectStoreNames.contains('groupKeys')) db.createObjectStore('groupKeys');
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			// If DB was already at a higher version (e.g. v3 from a previous deploy),
			// just open it without specifying a version
			const retry = indexedDB.open(dbName(userId));
			retry.onsuccess = () => resolve(retry.result);
			retry.onerror = () => reject(retry.error);
		};
	});
}

function idbGet(db: IDBDatabase, store: string, key: string): Promise<any> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readonly');
		const req = tx.objectStore(store).get(key);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function idbPut(db: IDBDatabase, store: string, key: string, value: any): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readwrite');
		tx.objectStore(store).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tx = db.transaction(store, 'readwrite');
		tx.objectStore(store).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export class SignalProtocolStore {
	private db: IDBDatabase | null = null;
	private userId: string;

	constructor(userId: string) {
		this.userId = userId;
	}

	async open(): Promise<void> {
		this.db = await openDB(this.userId);
	}

	private ensureDB(): IDBDatabase {
		if (!this.db) throw new Error('Store not opened');
		return this.db;
	}

	// Address helper: "<userId>.1"
	static address(userId: string): string {
		return `${userId}.1`;
	}

	// Identity key pair (our own — Curve25519 for Signal Protocol)
	async getIdentityKeyPair(): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer } | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'identity', 'identityKey');
	}

	async setIdentityKeyPair(keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer }): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'identity', 'identityKey', keyPair);
	}

	// Ed25519 signing key pair (separate from Signal identity key)
	async getSigningKeyPair(): Promise<CryptoKeyPair | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'identity', 'signingKey');
	}

	async setSigningKeyPair(keyPair: CryptoKeyPair): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'identity', 'signingKey', keyPair);
	}

	async getLocalRegistrationId(): Promise<number | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'identity', 'registrationId');
	}

	async setLocalRegistrationId(id: number): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'identity', 'registrationId', id);
	}

	// Remote identity keys (TOFU)
	async isTrustedIdentity(
		identifier: string,
		identityKey: ArrayBuffer,
		_direction: number
	): Promise<boolean> {
		const db = this.ensureDB();
		const existing = await idbGet(db, 'identityKeys', identifier);
		if (!existing) return true; // TOFU: trust on first use
		return this.arrayBuffersEqual(existing, identityKey);
	}

	async saveIdentity(identifier: string, identityKey: ArrayBuffer): Promise<boolean> {
		const db = this.ensureDB();
		const existing = await idbGet(db, 'identityKeys', identifier);
		await idbPut(db, 'identityKeys', identifier, identityKey);
		return !!existing && !this.arrayBuffersEqual(existing, identityKey);
	}

	async loadIdentityKey(identifier: string): Promise<ArrayBuffer | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'identityKeys', identifier);
	}

	// Sessions
	async loadSession(identifier: string): Promise<any | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'sessions', identifier);
	}

	async storeSession(identifier: string, record: any): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'sessions', identifier, record);
	}

	// Prekeys
	async loadPreKey(keyId: number): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer } | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'prekeys', String(keyId));
	}

	async storePreKey(keyId: number, keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer }): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'prekeys', String(keyId), keyPair);
	}

	async removePreKey(keyId: number): Promise<void> {
		const db = this.ensureDB();
		await idbDelete(db, 'prekeys', String(keyId));
	}

	// Signed prekeys
	async loadSignedPreKey(keyId: number): Promise<{ pubKey: ArrayBuffer; privKey: ArrayBuffer } | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'signedPrekeys', String(keyId));
	}

	async storeSignedPreKey(keyId: number, keyPair: { pubKey: ArrayBuffer; privKey: ArrayBuffer }): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'signedPrekeys', String(keyId), keyPair);
	}

	async removeSignedPreKey(keyId: number): Promise<void> {
		const db = this.ensureDB();
		await idbDelete(db, 'signedPrekeys', String(keyId));
	}

	// Next prekey ID tracking
	async getNextPreKeyId(): Promise<number> {
		const db = this.ensureDB();
		return (await idbGet(db, 'identity', 'nextPreKeyId')) ?? 1;
	}

	async setNextPreKeyId(id: number): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'identity', 'nextPreKeyId', id);
	}

	async getNextSignedPreKeyId(): Promise<number> {
		const db = this.ensureDB();
		return (await idbGet(db, 'identity', 'nextSignedPreKeyId')) ?? 1;
	}

	async setNextSignedPreKeyId(id: number): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'identity', 'nextSignedPreKeyId', id);
	}

	// Sent message plaintext cache — uses localStorage to avoid DB version bumps
	async storeSentMessage(ciphertext: string, plaintext: string): Promise<void> {
		try {
			const key = `oceana-sent-${ciphertext.slice(0, 48)}`;
			localStorage.setItem(key, plaintext);
		} catch { /* storage full or unavailable */ }
	}

	async loadSentMessage(ciphertext: string): Promise<string | undefined> {
		try {
			const key = `oceana-sent-${ciphertext.slice(0, 48)}`;
			return localStorage.getItem(key) ?? undefined;
		} catch {
			return undefined;
		}
	}

	// Group keys
	async storeGroupKey(groupId: string, key: CryptoKey): Promise<void> {
		const db = this.ensureDB();
		await idbPut(db, 'groupKeys', groupId, key);
	}

	async loadGroupKey(groupId: string): Promise<CryptoKey | undefined> {
		const db = this.ensureDB();
		return idbGet(db, 'groupKeys', groupId);
	}

	private arrayBuffersEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
		if (a.byteLength !== b.byteLength) return false;
		const va = new Uint8Array(a);
		const vb = new Uint8Array(b);
		for (let i = 0; i < va.length; i++) {
			if (va[i] !== vb[i]) return false;
		}
		return true;
	}
}

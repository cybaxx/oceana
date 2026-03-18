# Oceana Encryption & Cryptography

Oceana implements end-to-end encrypted chat using the Signal Protocol and signed posts using Ed25519. All cryptographic operations happen client-side in the browser.

---

## Signal Protocol (E2EE Chat)

The Signal Protocol provides forward secrecy and future secrecy for all chat messages. The server never sees plaintext for encrypted conversations.

### Key Types

| Key | Algorithm | Lifetime | Storage |
|-----|-----------|----------|---------|
| Identity Key | Curve25519 | Permanent | IndexedDB (private), PostgreSQL (public) |
| Signed PreKey | Curve25519 | Medium-term | IndexedDB (private), PostgreSQL (public) |
| One-Time PreKeys | Curve25519 | Single use | IndexedDB (private), PostgreSQL (public) |
| Ed25519 Signing Key | Ed25519 | Permanent | IndexedDB (private), PostgreSQL (public) |

### Key Generation

On first login, the client generates:

1. **Registration ID** — random identifier for the Signal Protocol session
2. **Identity Key Pair** — long-lived Curve25519 key pair
3. **Signed PreKey** — signed with the identity key
4. **100 One-Time PreKeys** — ephemeral keys, each consumed once
5. **Ed25519 Signing Key** — for post signatures (separate from Signal identity)

All keys are stored in IndexedDB under `oceana-keys-${userId}`. The public portions are uploaded to the server via `PUT /api/v1/keys/bundle`.

### Session Establishment (X3DH)

When Alice wants to message Bob for the first time:

```
1. Alice fetches Bob's key bundle from the server:
   - Bob's Identity Key (IK_B)
   - Bob's Signed PreKey (SPK_B) + signature
   - One One-Time PreKey (OPK_B) — consumed from server

2. Alice generates an ephemeral key pair (EK_A)

3. Alice computes 4 Diffie-Hellman exchanges:
   DH1 = X25519(IK_A_private, SPK_B)
   DH2 = X25519(EK_A_private, IK_B)
   DH3 = X25519(EK_A_private, SPK_B)
   DH4 = X25519(EK_A_private, OPK_B)

4. Shared secret = KDF(DH1 || DH2 || DH3 || DH4)

5. First message includes:
   - Alice's Identity Key
   - Alice's Ephemeral Key
   - Which OPK was used
   - Ciphertext (PreKeyWhisperMessage, type 3)

6. Bob reconstructs the same shared secret using his private keys
```

### Message Encryption (Double Ratchet)

After session establishment, every message uses the Double Ratchet algorithm:

- Each message gets a unique encryption key derived from the ratchet state
- **Forward secrecy**: compromising current keys doesn't reveal past messages
- **Future secrecy**: compromising current keys eventually becomes useless as the ratchet advances
- Message types: `2` = WhisperMessage (regular), `3` = PreKeyWhisperMessage (session init)

### OPK Management

- 100 OPKs generated on signup
- Auto-replenished when count drops below 20
- OPKs are only served to users who share a conversation with the target
- Check remaining count: `GET /api/v1/keys/count`

### Trust Model

**TOFU (Trust On First Use):** The client accepts the first identity key seen for each user and stores it in IndexedDB. This is simple but does not protect against man-in-the-middle attacks on first contact.

### Implementation

| Component | File |
|-----------|------|
| Key generation & bundle upload | `frontend/src/lib/crypto/keys.ts` |
| X3DH session init, encrypt, decrypt | `frontend/src/lib/crypto/signal.ts` |
| IndexedDB key store | `frontend/src/lib/crypto/store.ts` |
| Singleton init & orchestration | `frontend/src/lib/crypto/index.ts` |
| Chat store with E2EE integration | `frontend/src/lib/stores/chat.ts` |
| Server-side key storage | `backend/src/routes.rs` (key bundle endpoints) |

**Library:** `@privacyresearch/libsignal-protocol-typescript` — pure TypeScript implementation of the Signal Protocol.

---

## Post Signing (Ed25519)

Posts can be cryptographically signed to prove authorship.

### How It Works

1. User generates an Ed25519 key pair via Web Crypto API
2. Public key is uploaded to the server (stored in `users.signing_key`)
3. When creating a post, the client signs the content with the private key
4. The base64 signature is stored in `posts.signature`
5. Other clients verify the signature against the author's public signing key

### Verification Flow

```
1. Feed loads posts with author_signing_key
2. For each post with a signature:
   a. Import the author's Ed25519 public key
   b. Verify the signature against the post content
   c. Display badge: ✓ verified / ✗ bad signature / ⏳ checking
3. Unsigned posts show "unsigned" indicator
```

### Implementation

- **Sign:** `crypto.subtle.sign("Ed25519", privateKey, content)` → base64
- **Verify:** `crypto.subtle.verify("Ed25519", publicKey, signature, content)` → boolean
- **Key storage:** IndexedDB (`signingKeyPair` object store)

---

## Security Considerations

| Concern | Status |
|---------|--------|
| Server never sees plaintext (E2EE) | Implemented |
| Forward secrecy via Double Ratchet | Implemented |
| OPK exhaustion protection | Implemented (conversation-gated) |
| Key verification / safety numbers | Not yet implemented |
| Key change warnings | Not yet implemented |
| Group chat E2EE | Per-recipient encryption (no Sender Keys yet) |
| JWT stored in localStorage | XSS risk — migrate to httpOnly cookies for production |

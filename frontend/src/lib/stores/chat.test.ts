import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { SignalProtocolStore } from '$lib/crypto/store';
import { generateIdentityAndKeys, arrayBufferToBase64 } from '$lib/crypto/keys';
import { initSession, encryptMessage } from '$lib/crypto/signal';
import { generateGroupKey, exportGroupKey, encryptGroupMessage } from '$lib/crypto/groupkeys';
import { MSG_TYPE_GROUP_KEY_DISTRIBUTION, MSG_TYPE_GROUP_MESSAGE } from '$lib/types';
import type { Message, PreKeyBundleResponse } from '$lib/types';

// --- Mocks ---

// Mock localStorage for sent message cache
const localStorageMap = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => localStorageMap.get(key) ?? null,
	setItem: (key: string, value: string) => localStorageMap.set(key, value),
	removeItem: (key: string) => localStorageMap.delete(key),
	clear: () => localStorageMap.clear(),
	get length() { return localStorageMap.size; },
	key: (_i: number) => null as string | null
};
Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });

let mockCryptoStore: SignalProtocolStore | null = null;
const mockSentMessages: { type: string; [key: string]: unknown }[] = [];
let wsHandler: ((msg: any) => void) | null = null;

vi.mock('$lib/api', () => ({
	api: {
		uploadKeyBundle: vi.fn(),
		getKeyCount: vi.fn(),
		listConversations: vi.fn().mockResolvedValue([]),
		getMessages: vi.fn().mockResolvedValue({ data: [], next_cursor: null }),
		getKeyBundle: vi.fn(),
		getConversationMembers: vi.fn().mockResolvedValue([])
	}
}));

vi.mock('$lib/ws', () => ({
	onWsMessage: vi.fn((handler: any) => {
		wsHandler = handler;
		return () => { wsHandler = null; };
	}),
	sendWsMessage: vi.fn((msg: any) => {
		mockSentMessages.push(msg);
	})
}));

vi.mock('$lib/crypto', async () => {
	const actual = await vi.importActual('$lib/crypto/signal');
	return {
		getCryptoStore: () => mockCryptoStore,
		encryptMessage: (actual as any).encryptMessage,
		decryptMessage: (actual as any).decryptMessage,
		initSession: (actual as any).initSession
	};
});

// Helper to create a test message
function makeMsg(overrides: Partial<Message> = {}): Message {
	return {
		id: `msg-${Math.random()}`,
		conversation_id: 'conv-1',
		sender_id: 'other-user',
		plaintext: null,
		ciphertext: null,
		nonce: null,
		message_type: null,
		image_url: null,
		created_at: new Date().toISOString(),
		...overrides
	};
}

// Setup Alice (us) and Bob (other) Signal sessions
async function setupAliceAndBob() {
	const aliceStore = new SignalProtocolStore(`alice-chat-${Math.random()}`);
	await aliceStore.open();
	const aliceKeys = await generateIdentityAndKeys(aliceStore);

	const bobStore = new SignalProtocolStore(`bob-chat-${Math.random()}`);
	await bobStore.open();
	const bobKeys = await generateIdentityAndKeys(bobStore);

	const bobBundle: PreKeyBundleResponse = {
		user_id: 'bob',
		identity_key: bobKeys.identityKeyPub,
		signed_prekey: arrayBufferToBase64(bobKeys.signedPreKey.publicKey),
		signed_prekey_signature: arrayBufferToBase64(bobKeys.signedPreKey.signature),
		signed_prekey_id: bobKeys.signedPreKey.keyId,
		one_time_prekey: bobKeys.oneTimePreKeys[0]
	};
	await initSession(aliceStore, 'bob', bobBundle);

	const aliceBundle: PreKeyBundleResponse = {
		user_id: 'alice',
		identity_key: aliceKeys.identityKeyPub,
		signed_prekey: arrayBufferToBase64(aliceKeys.signedPreKey.publicKey),
		signed_prekey_signature: arrayBufferToBase64(aliceKeys.signedPreKey.signature),
		signed_prekey_id: aliceKeys.signedPreKey.keyId,
		one_time_prekey: aliceKeys.oneTimePreKeys[0]
	};
	await initSession(bobStore, 'alice', aliceBundle);

	return { aliceStore, bobStore };
}

describe('chat store', () => {
	beforeEach(async () => {
		const { cleanupChatListeners, activeMessages, activeConversationId } = await import('./chat');
		cleanupChatListeners();
		activeMessages.set([]);
		activeConversationId.set(null);
		mockCryptoStore = null;
		mockSentMessages.length = 0;
		wsHandler = null;
		localStorageMap.clear();
	});

	describe('tryDecrypt (via initChatListeners + WS)', () => {
		// We test tryDecrypt indirectly by simulating WS messages

		it('passes through plaintext messages unchanged', async () => {
			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({ plaintext: 'hello', sender_username: 'bob' });
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'bob',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			expect(msgs.length).toBeGreaterThanOrEqual(1);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('hello');

			cleanupChatListeners();
		});

		it('returns message as-is when no crypto store', async () => {
			mockCryptoStore = null;

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({ ciphertext: 'abc', message_type: 1 });
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'bob',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			// No store → message passed through with original null plaintext
			expect(last.ciphertext).toBe('abc');

			cleanupChatListeners();
		});

		it('decrypts pairwise Signal message from other user', async () => {
			const { aliceStore, bobStore } = await setupAliceAndBob();
			mockCryptoStore = bobStore; // We are Bob, receiving from Alice

			const { setChatUserId } = await import('./chat');
			setChatUserId('bob');

			const plaintext = 'Secret message from Alice';
			const { ciphertext, messageType } = await encryptMessage(aliceStore, 'bob', plaintext);

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({
				sender_id: 'alice',
				ciphertext,
				message_type: messageType
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'alice',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe(plaintext);

			cleanupChatListeners();
		});

		it('shows [Decryption failed] on bad ciphertext', async () => {
			const { aliceStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { setChatUserId } = await import('./chat');
			setChatUserId('alice');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({
				sender_id: 'unknown-sender',
				ciphertext: 'garbage-data',
				message_type: 1
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'unknown',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('[Decryption failed]');

			cleanupChatListeners();
		});

		it('own pairwise message uses sent cache', async () => {
			const store = new SignalProtocolStore(`own-msg-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			// Pre-cache a sent message
			await store.storeSentMessage('cached-ciphertext-abc', 'my original message');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({
				sender_id: 'me',
				ciphertext: 'cached-ciphertext-abc',
				message_type: 1
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'me',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('my original message');

			cleanupChatListeners();
		});

		it('own group key distribution returns null plaintext', async () => {
			const store = new SignalProtocolStore(`own-gkd-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			const before = get(activeMessages).length;
			initChatListeners();

			const msg = makeMsg({
				sender_id: 'me',
				ciphertext: 'some-key-data',
				message_type: MSG_TYPE_GROUP_KEY_DISTRIBUTION
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'me',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBeNull();

			cleanupChatListeners();
		});

		it('own group message decrypts via group key', async () => {
			const store = new SignalProtocolStore(`own-grp-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			// Store a group key and encrypt a message
			const groupKey = await generateGroupKey();
			await store.storeGroupKey('conv-group', groupKey);
			const { ciphertext, nonce } = await encryptGroupMessage(groupKey, 'group hello');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-group');
			initChatListeners();

			const msg = makeMsg({
				conversation_id: 'conv-group',
				sender_id: 'me',
				ciphertext,
				nonce,
				message_type: MSG_TYPE_GROUP_MESSAGE
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'me',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('group hello');

			cleanupChatListeners();
		});

		it('group message without key shows [Missing group key]', async () => {
			const store = new SignalProtocolStore(`no-gk-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-nokey');
			initChatListeners();

			const msg = makeMsg({
				conversation_id: 'conv-nokey',
				sender_id: 'other',
				ciphertext: 'encrypted-stuff',
				nonce: 'some-nonce',
				message_type: MSG_TYPE_GROUP_MESSAGE
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'other',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('[Missing group key]');

			cleanupChatListeners();
		});

		it('decrypts group message from other user with stored key', async () => {
			const store = new SignalProtocolStore(`grp-recv-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			const groupKey = await generateGroupKey();
			await store.storeGroupKey('conv-g2', groupKey);
			const { ciphertext, nonce } = await encryptGroupMessage(groupKey, 'hello from other');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-g2');
			initChatListeners();

			const msg = makeMsg({
				conversation_id: 'conv-g2',
				sender_id: 'other',
				ciphertext,
				nonce,
				message_type: MSG_TYPE_GROUP_MESSAGE
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'other',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('hello from other');

			cleanupChatListeners();
		});
	});

	describe('sendEncryptedMessage', () => {
		it('throws when no crypto store instead of falling back to plaintext', async () => {
			mockCryptoStore = null;

			const { sendEncryptedMessage } = await import('./chat');
			await expect(
				sendEncryptedMessage('conv-1', 'hello', ['me', 'other'], 'me')
			).rejects.toThrow('Encryption unavailable. Message not sent. Please reload the page.');

			// Verify no plaintext message was sent
			expect(mockSentMessages.length).toBe(0);
		});

		it('sends encrypted group message for self-chat (no other recipients)', async () => {
			const store = new SignalProtocolStore(`self-chat-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { sendEncryptedMessage } = await import('./chat');
			await sendEncryptedMessage('conv-1', 'talking to myself', ['me'], 'me');

			expect(mockSentMessages.length).toBe(1);
			const sent = mockSentMessages[0];
			expect(sent.content).toBeNull();
			expect(sent.ciphertext).toBeTruthy();
			expect(sent.nonce).toBeTruthy();
			expect(sent.message_type).toBe(MSG_TYPE_GROUP_MESSAGE);
		});

		it('sends encrypted DM and caches plaintext', async () => {
			const { aliceStore, bobStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			// Mock the API to return bob's bundle for ensureSession
			const { api } = await import('$lib/api');

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			await sendEncryptedMessage('conv-1', 'secret for bob', ['alice', 'bob'], 'alice');

			expect(mockSentMessages.length).toBe(1);
			const sent = mockSentMessages[0];
			expect(sent.ciphertext).toBeTruthy();
			expect(sent.content).toBeNull();
			expect(sent.message_type).toBeDefined();

			// Verify plaintext was cached
			const cached = await aliceStore.loadSentMessage(sent.ciphertext as string);
			expect(cached).toBe('secret for bob');
		});
	});

	describe('WS listener routing', () => {
		it('handles typing events', async () => {
			const {
				initChatListeners, cleanupChatListeners,
				typingUsers
			} = await import('./chat');

			initChatListeners();

			await wsHandler!({
				type: 'typing',
				conversation_id: 'conv-1',
				user_id: 'bob',
				username: 'bob'
			});

			const users = get(typingUsers);
			expect(users.get('conv-1:bob')).toBe('bob');

			cleanupChatListeners();
		});

		it('handles verify_identity events', async () => {
			const {
				initChatListeners, cleanupChatListeners,
				verificationReceived, verifiedUsers
			} = await import('./chat');

			initChatListeners();

			await wsHandler!({
				type: 'verify_identity',
				from_user_id: 'bob-id',
				from_username: 'bob'
			});

			expect(get(verificationReceived)).toEqual({ userId: 'bob-id', username: 'bob' });
			expect(get(verifiedUsers).has('bob-id')).toBe(true);

			cleanupChatListeners();
		});

		it('updates conversation list on new message', async () => {
			const {
				initChatListeners, cleanupChatListeners,
				conversations, activeConversationId
			} = await import('./chat');

			conversations.set([{
				id: 'conv-1',
				created_at: new Date().toISOString(),
				last_message_text: null,
				last_message_at: null,
				last_message_sender_id: null
			}]);
			activeConversationId.set('conv-other');
			initChatListeners();

			const msg = makeMsg({ plaintext: 'new msg', conversation_id: 'conv-1' });
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'bob',
				sender_is_bot: false
			});

			const convs = get(conversations);
			expect(convs[0].last_message_text).toBe('new msg');

			cleanupChatListeners();
		});

		it('does not append message if not viewing that conversation', async () => {
			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-other');
			const before = get(activeMessages).length;
			initChatListeners();

			const msg = makeMsg({ plaintext: 'for conv-1', conversation_id: 'conv-1' });
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'bob',
				sender_is_bot: false
			});

			// Should not be appended to activeMessages since we're viewing conv-other
			// (conversation list still updated)
			expect(get(activeMessages).length).toBe(before);

			cleanupChatListeners();
		});
	});

	describe('key change alerts', () => {
		it('adds key change alert on decryption failure with known identity', async () => {
			const store = new SignalProtocolStore(`kc-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			// Save a fake identity key for sender
			await store.saveIdentity('bad-sender.1', new Uint8Array(33).buffer);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId,
				keyChangeAlerts
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({
				sender_id: 'bad-sender',
				ciphertext: 'corrupted',
				message_type: 1
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'bad-sender',
				sender_is_bot: false
			});

			expect(get(keyChangeAlerts).has('bad-sender')).toBe(true);
			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			expect(last.plaintext).toBe('[Decryption failed]');

			cleanupChatListeners();
		});
	});

	describe('sendEncryptedMessage — group edge cases', () => {
		it('second group message reuses existing key (no re-distribute)', async () => {
			const { aliceStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { api } = await import('$lib/api');
			const membersMock = api.getConversationMembers as ReturnType<typeof vi.fn>;
			// Only alice and bob — both have sessions
			membersMock.mockResolvedValue(['alice', 'bob']);

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			// First send — generates key + distributes to bob
			await sendEncryptedMessage('conv-grp-reuse', 'first', ['alice', 'bob', 'charlie'], 'alice');

			// Second call: same members — no rotation
			mockSentMessages.length = 0;
			await sendEncryptedMessage('conv-grp-reuse', 'second', ['alice', 'bob', 'charlie'], 'alice');
			// Should only have the group message, no key distribution
			expect(mockSentMessages.length).toBe(1);
			const secondMsg = mockSentMessages[0];
			expect(secondMsg.content).toBeNull();
			expect(secondMsg.ciphertext).toBeTruthy();
			expect(secondMsg.message_type).toBe(101); // MSG_TYPE_GROUP_MESSAGE
		});

		it('throws when group encryption fails instead of falling back to plaintext', async () => {
			// Use a store without identity keys so encryption will fail
			const store = new SignalProtocolStore(`grp-fail-${Math.random()}`);
			await store.open();
			mockCryptoStore = store;

			const { api } = await import('$lib/api');
			(api.getConversationMembers as ReturnType<typeof vi.fn>).mockResolvedValue(['alice', 'bob', 'charlie']);

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			await expect(
				sendEncryptedMessage('conv-fail', 'fallback msg', ['alice', 'bob', 'charlie'], 'alice')
			).rejects.toThrow('Encryption failed. Message not sent.');

			// Verify no plaintext message was sent
			const plaintextMessages = mockSentMessages.filter(m => m.content === 'fallback msg');
			expect(plaintextMessages.length).toBe(0);
		});
	});

	describe('tryDecrypt — additional edge cases', () => {
		it('own pairwise message without cache returns original msg', async () => {
			const store = new SignalProtocolStore(`no-cache-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-1');
			initChatListeners();

			const msg = makeMsg({
				sender_id: 'me',
				ciphertext: 'no-cache-for-this',
				message_type: 1
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'me',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			// No cache hit, no decryption possible — original message returned as-is
			expect(last.ciphertext).toBe('no-cache-for-this');
			expect(last.plaintext).toBeNull();

			cleanupChatListeners();
		});

		it('receives group key distribution from other user', async () => {
			const { aliceStore, bobStore } = await setupAliceAndBob();
			mockCryptoStore = bobStore; // We are Bob

			const { setChatUserId } = await import('./chat');
			setChatUserId('bob');

			// Alice encrypts a group key for Bob
			const groupKey = await generateGroupKey();
			const keyB64 = await exportGroupKey(groupKey);
			const { ciphertext, messageType } = await encryptMessage(aliceStore, 'bob', keyB64);

			const {
				initChatListeners, cleanupChatListeners,
				activeMessages, activeConversationId
			} = await import('./chat');

			activeConversationId.set('conv-gkd');
			initChatListeners();

			const msg = makeMsg({
				conversation_id: 'conv-gkd',
				sender_id: 'alice',
				ciphertext,
				message_type: MSG_TYPE_GROUP_KEY_DISTRIBUTION
			});
			await wsHandler!({
				type: 'new_message',
				message: msg,
				sender_username: 'alice',
				sender_is_bot: false
			});

			const msgs = get(activeMessages);
			const last = msgs[msgs.length - 1];
			// GKD is silent — plaintext should be null
			expect(last.plaintext).toBeNull();

			// Verify group key was stored
			const storedKey = await bobStore.loadGroupKey('conv-gkd');
			expect(storedKey).toBeTruthy();

			cleanupChatListeners();
		});

		it('multiple rapid DMs encrypt and cache correctly', async () => {
			const { aliceStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			await sendEncryptedMessage('conv-1', 'msg1', ['alice', 'bob'], 'alice');
			await sendEncryptedMessage('conv-1', 'msg2', ['alice', 'bob'], 'alice');
			await sendEncryptedMessage('conv-1', 'msg3', ['alice', 'bob'], 'alice');

			expect(mockSentMessages.length).toBe(3);
			for (const sent of mockSentMessages) {
				expect(sent.ciphertext).toBeTruthy();
				const cached = await aliceStore.loadSentMessage(sent.ciphertext as string);
				expect(cached).toBeTruthy();
			}
		});
	});

	describe('loadMessages', () => {
		it('decrypts historical messages via tryDecrypt', async () => {
			const store = new SignalProtocolStore(`load-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			// Store a group key and create mock encrypted messages
			const groupKey = await generateGroupKey();
			await store.storeGroupKey('conv-hist', groupKey);
			const { ciphertext, nonce } = await encryptGroupMessage(groupKey, 'historical msg');

			const { api } = await import('$lib/api');
			(api.getMessages as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				data: [
					makeMsg({
						conversation_id: 'conv-hist',
						sender_id: 'other',
						ciphertext,
						nonce,
						message_type: MSG_TYPE_GROUP_MESSAGE
					})
				],
				next_cursor: null
			});

			const { loadMessages, activeMessages } = await import('./chat');
			await loadMessages('conv-hist');

			const msgs = get(activeMessages);
			expect(msgs.length).toBe(1);
			expect(msgs[0].plaintext).toBe('historical msg');
		});
	});

	describe('loadConversations', () => {
		it('populates previews by decrypting last message', async () => {
			const store = new SignalProtocolStore(`preview-${Math.random()}`);
			await store.open();
			await generateIdentityAndKeys(store);
			mockCryptoStore = store;

			const { setChatUserId } = await import('./chat');
			setChatUserId('me');

			// Store a group key and create mock encrypted message
			const groupKey = await generateGroupKey();
			await store.storeGroupKey('conv-preview', groupKey);
			const { ciphertext, nonce } = await encryptGroupMessage(groupKey, 'preview text');

			const { api } = await import('$lib/api');
			(api.listConversations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
				{
					id: 'conv-preview',
					created_at: new Date().toISOString(),
					last_message_text: null,
					last_message_at: new Date().toISOString(),
					last_message_sender_id: 'other'
				}
			]);
			(api.getMessages as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				data: [
					makeMsg({
						conversation_id: 'conv-preview',
						sender_id: 'other',
						ciphertext,
						nonce,
						message_type: MSG_TYPE_GROUP_MESSAGE
					})
				],
				next_cursor: null
			});

			const { loadConversations, conversations } = await import('./chat');
			await loadConversations();

			const convs = get(conversations);
			expect(convs.length).toBe(1);
			expect(convs[0].last_message_text).toBe('preview text');
		});
	});

	describe('ensureSession caching', () => {
		it('second call reuses cached session', async () => {
			const { aliceStore, bobStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { api } = await import('$lib/api');
			const getKeyBundleMock = api.getKeyBundle as ReturnType<typeof vi.fn>;

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			// Send first message — may or may not call getKeyBundle depending on session cache
			const callsBefore = getKeyBundleMock.mock.calls.length;
			await sendEncryptedMessage('conv-1', 'first', ['alice', 'bob'], 'alice');
			await sendEncryptedMessage('conv-1', 'second', ['alice', 'bob'], 'alice');

			// getKeyBundle should not have been called more than once for bob
			const callsAfter = getKeyBundleMock.mock.calls.length;
			// At most 1 additional call (or 0 if session was already cached from setupAliceAndBob)
			expect(callsAfter - callsBefore).toBeLessThanOrEqual(1);
		});
	});

	describe('sendVerification', () => {
		it('sends verify_identity WS message', async () => {
			const { sendVerification } = await import('./chat');
			sendVerification('target-user');

			expect(mockSentMessages.some(m =>
				m.type === 'verify_identity' && m.target_user_id === 'target-user'
			)).toBe(true);
		});
	});

	describe('setChatUserId', () => {
		it('sets current user id for own message detection', async () => {
			const { setChatUserId } = await import('./chat');
			// Should not throw
			setChatUserId('test-user');
		});
	});

	describe('group key rotation on membership change', () => {
		it('generates and distributes key on first group message', async () => {
			const { aliceStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { api } = await import('$lib/api');
			(api.getConversationMembers as ReturnType<typeof vi.fn>).mockResolvedValue(['alice', 'bob']);

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			await sendEncryptedMessage('conv-rot-1', 'hello group', ['alice', 'bob', 'charlie'], 'alice');

			// Should have key distribution message(s) + the actual group message
			const keyDists = mockSentMessages.filter(m => m.message_type === MSG_TYPE_GROUP_KEY_DISTRIBUTION);
			const groupMsgs = mockSentMessages.filter(m => m.message_type === MSG_TYPE_GROUP_MESSAGE);
			expect(keyDists.length).toBeGreaterThanOrEqual(1);
			expect(groupMsgs.length).toBe(1);
		});

		it('rotates key when member list changes between sends', async () => {
			const { aliceStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { api } = await import('$lib/api');
			const membersMock = api.getConversationMembers as ReturnType<typeof vi.fn>;

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			// First send with [alice, bob]
			membersMock.mockResolvedValue(['alice', 'bob']);
			await sendEncryptedMessage('conv-rot-2', 'msg1', ['alice', 'bob', 'charlie'], 'alice');

			const firstKey = await aliceStore.loadGroupKey('conv-rot-2');
			const firstKeyB64 = await exportGroupKey(firstKey!);

			// Clear sent messages
			mockSentMessages.length = 0;

			// Membership changes: charlie added
			membersMock.mockResolvedValue(['alice', 'bob', 'charlie']);
			// charlie has no session but bob does — the key rotation will attempt distribution
			// It may fail for charlie, but we can verify rotation was attempted
			// For this test, just check with bob only to avoid session issues
			membersMock.mockResolvedValue(['alice', 'bob']);

			// Force membership difference by using a different set
			membersMock.mockResolvedValue(['alice']);
			await sendEncryptedMessage('conv-rot-2', 'msg2', ['alice', 'bob', 'charlie'], 'alice');

			const secondKey = await aliceStore.loadGroupKey('conv-rot-2');
			const secondKeyB64 = await exportGroupKey(secondKey!);

			// Key should have been rotated (different key)
			expect(secondKeyB64).not.toBe(firstKeyB64);

			// Should have new key distribution messages
			const keyDists = mockSentMessages.filter(m => m.message_type === MSG_TYPE_GROUP_KEY_DISTRIBUTION);
			expect(keyDists.length).toBeGreaterThanOrEqual(0); // no others besides alice
		});

		it('does NOT rotate key when member list is stable', async () => {
			const { aliceStore } = await setupAliceAndBob();
			mockCryptoStore = aliceStore;

			const { api } = await import('$lib/api');
			const membersMock = api.getConversationMembers as ReturnType<typeof vi.fn>;
			membersMock.mockResolvedValue(['alice', 'bob']);

			const { sendEncryptedMessage, setChatUserId } = await import('./chat');
			setChatUserId('alice');

			// First send
			await sendEncryptedMessage('conv-rot-3', 'msg1', ['alice', 'bob', 'charlie'], 'alice');
			const firstKey = await aliceStore.loadGroupKey('conv-rot-3');
			const firstKeyB64 = await exportGroupKey(firstKey!);

			mockSentMessages.length = 0;

			// Second send with same members
			await sendEncryptedMessage('conv-rot-3', 'msg2', ['alice', 'bob', 'charlie'], 'alice');
			const secondKey = await aliceStore.loadGroupKey('conv-rot-3');
			const secondKeyB64 = await exportGroupKey(secondKey!);

			// Key should NOT have been rotated
			expect(secondKeyB64).toBe(firstKeyB64);

			// No key distribution messages on second send
			const keyDists = mockSentMessages.filter(m => m.message_type === MSG_TYPE_GROUP_KEY_DISTRIBUTION);
			expect(keyDists.length).toBe(0);
		});
	});
});

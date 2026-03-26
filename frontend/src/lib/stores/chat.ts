import { writable, get } from 'svelte/store';
import type { Conversation, Message, WsServerMessage, PreKeyBundleResponse } from '$lib/types';
import { MSG_TYPE_GROUP_KEY_DISTRIBUTION, MSG_TYPE_GROUP_MESSAGE } from '$lib/types';
import { api } from '$lib/api';
import { onWsMessage, sendWsMessage } from '$lib/ws';
import { getCryptoStore, encryptMessage, decryptMessage, initSession } from '$lib/crypto';
import {
	generateGroupKey,
	exportGroupKey,
	importGroupKey,
	encryptGroupMessage,
	decryptGroupMessage
} from '$lib/crypto/groupkeys';

export const conversations = writable<Conversation[]>([]);
export const activeMessages = writable<Message[]>([]);
export const activeConversationId = writable<string | null>(null);
export const messagesCursor = writable<string | null>(null);
export const keyChangeAlerts = writable<Set<string>>(new Set());
export const verifiedUsers = writable<Set<string>>(new Set());
export const verificationReceived = writable<{ userId: string; username: string } | null>(null);

// typingUsers: Map<visually keyed as `${conversationId}:${userId}`, username>
export const typingUsers = writable<Map<string, string>>(new Map());
const typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addTypingUser(conversationId: string, userId: string, username: string) {
	const key = `${conversationId}:${userId}`;
	// Clear existing timeout
	const existing = typingTimeouts.get(key);
	if (existing) clearTimeout(existing);
	// Set new timeout to auto-clear after 3s
	const timeout = setTimeout(() => {
		typingUsers.update((m) => { m.delete(key); return new Map(m); });
		typingTimeouts.delete(key);
	}, 3000);
	typingTimeouts.set(key, timeout);
	typingUsers.update((m) => { m.set(key, username); return new Map(m); });
}

export function clearTyping() {
	typingTimeouts.forEach((t) => clearTimeout(t));
	typingTimeouts.clear();
	typingUsers.set(new Map());
}

let unsubWs: (() => void) | null = null;

// Current user ID, set during init
let currentUserId: string | null = null;

export function setChatUserId(userId: string) {
	currentUserId = userId;
}

async function tryDecrypt(msg: Message): Promise<Message> {
	if (!msg.ciphertext || !msg.message_type) return msg;
	const store = getCryptoStore();
	if (!store) return msg;

	// Sender can't decrypt their own pairwise ciphertext
	if (msg.sender_id === currentUserId) {
		// For group messages (AES-GCM), sender CAN decrypt since they have the key
		if (msg.message_type === MSG_TYPE_GROUP_MESSAGE) {
			const groupKey = await store.loadGroupKey(msg.conversation_id);
			if (groupKey) {
				try {
					const plaintext = await decryptGroupMessage(groupKey, msg.ciphertext, msg.nonce || '');
					return { ...msg, plaintext };
				} catch { /* fall through */ }
			}
		}
		// For group key distribution, hide it
		if (msg.message_type === MSG_TYPE_GROUP_KEY_DISTRIBUTION) {
			return { ...msg, plaintext: null };
		}
		// For pairwise encrypted own messages, look up cached plaintext
		const cached = await store.loadSentMessage(msg.ciphertext!);
		if (cached) {
			return { ...msg, plaintext: cached };
		}
		return msg;
	}
	try {
		// Group key distribution — decrypt pairwise, then store group key
		if (msg.message_type === MSG_TYPE_GROUP_KEY_DISTRIBUTION) {
			const keyB64 = await decryptMessage(store, msg.sender_id, msg.ciphertext, 3);
			const groupKey = await importGroupKey(keyB64);
			await store.storeGroupKey(msg.conversation_id, groupKey);
			return { ...msg, plaintext: null }; // silent system message
		}

		// Group encrypted message
		if (msg.message_type === MSG_TYPE_GROUP_MESSAGE) {
			const groupKey = await store.loadGroupKey(msg.conversation_id);
			if (!groupKey) return { ...msg, plaintext: '[Missing group key]' };
			const plaintext = await decryptGroupMessage(groupKey, msg.ciphertext, msg.nonce || '');
			return { ...msg, plaintext };
		}

		// Standard pairwise Signal decryption
		const plaintext = await decryptMessage(store, msg.sender_id, msg.ciphertext, msg.message_type);
		return { ...msg, plaintext };
	} catch (e) {
		console.error('Decryption failed for message', msg.id, e);
		// Check if this might be a key change
		const existingKey = await store.loadIdentityKey(`${msg.sender_id}.1`);
		if (existingKey) {
			keyChangeAlerts.update((s) => { s.add(msg.sender_id); return new Set(s); });
		}
		return { ...msg, plaintext: '[Decryption failed]' };
	}
}

export function sendVerification(targetUserId: string) {
	sendWsMessage({ type: 'verify_identity', target_user_id: targetUserId });
}

export function initChatListeners() {
	if (unsubWs) return;
	unsubWs = onWsMessage(async (msg: WsServerMessage) => {
		if (msg.type === 'typing' && msg.conversation_id && msg.user_id && msg.username) {
			addTypingUser(msg.conversation_id, msg.user_id, msg.username);
			return;
		}
		if (msg.type === 'verify_identity' && msg.from_user_id && msg.from_username) {
			verificationReceived.set({ userId: msg.from_user_id, username: msg.from_username });
			verifiedUsers.update((s) => { s.add(msg.from_user_id!); return new Set(s); });
			return;
		}
		if (msg.type === 'new_message' && msg.message) {
			let message: Message = {
				...msg.message,
				sender_username: msg.sender_username,
				sender_is_bot: msg.sender_is_bot ?? false
			};
			message = await tryDecrypt(message);

			// If viewing this conversation, append
			if (get(activeConversationId) === message.conversation_id) {
				activeMessages.update((msgs) => [...msgs, message]);
			}
			// Update conversation list
			conversations.update((convs) => {
				const idx = convs.findIndex((c) => c.id === message.conversation_id);
				if (idx >= 0) {
					const conv = { ...convs[idx] };
					conv.last_message_text = message.plaintext || 'Encrypted message';
					conv.last_message_at = message.created_at;
					conv.last_message_sender_id = message.sender_id;
					const updated = [conv, ...convs.filter((_, i) => i !== idx)];
					return updated;
				}
				return convs;
			});
		}
	});
}

export function cleanupChatListeners() {
	if (unsubWs) {
		unsubWs();
		unsubWs = null;
	}
}

export async function loadConversations() {
	const convs = (await api.listConversations()) as Conversation[];
	// Decrypt previews client-side: fetch last message for each conversation
	const withPreviews = await Promise.all(
		convs.map(async (conv) => {
			if (!conv.last_message_at) return conv;
			try {
				const res = (await api.getMessages(conv.id)) as {
					data: Message[];
					next_cursor: string | null;
				};
				if (res.data.length > 0) {
					const decrypted = await tryDecrypt(res.data[0]);
					return { ...conv, last_message_text: decrypted.plaintext || 'Encrypted message' };
				}
			} catch { /* ignore preview failure */ }
			return conv;
		})
	);
	conversations.set(withPreviews);
}

export async function loadMessages(conversationId: string, cursor?: string) {
	activeConversationId.set(conversationId);
	const res = (await api.getMessages(conversationId, cursor)) as {
		data: Message[];
		next_cursor: string | null;
	};
	messagesCursor.set(res.next_cursor);
	// Decrypt any encrypted messages
	const decrypted = await Promise.all(res.data.map(tryDecrypt));
	// API returns newest first, reverse for display
	if (cursor) {
		// Prepend older messages
		activeMessages.update((msgs) => [...decrypted.reverse(), ...msgs]);
	} else {
		activeMessages.set(decrypted.reverse());
	}
}

// Session cache to avoid re-fetching bundles
const sessionInitialized = new Set<string>();
// Track which members received the current group key per conversation
const groupKeyMembers = new Map<string, string[]>(); // conversationId → sorted member IDs

async function ensureSession(recipientUserId: string): Promise<void> {
	if (sessionInitialized.has(recipientUserId)) return;
	const store = getCryptoStore();
	if (!store) return;

	// Check if we already have a session
	const existing = await store.loadSession(`${recipientUserId}.1`);
	if (existing) {
		sessionInitialized.add(recipientUserId);
		return;
	}

	// Fetch bundle and init session
	const bundle = (await api.getKeyBundle(recipientUserId)) as PreKeyBundleResponse;
	await initSession(store, recipientUserId, bundle);
	sessionInitialized.add(recipientUserId);
}

export async function sendEncryptedMessage(
	conversationId: string,
	plaintext: string,
	recipientIds: string[],
	currentUserId: string,
	imageUrl?: string
): Promise<void> {
	const store = getCryptoStore();

	if (!store) {
		throw new Error('Encryption unavailable. Message not sent. Please reload the page.');
	}

	const others = recipientIds.filter((id) => id !== currentUserId);

	// Group chat (3+ members): use AES-256-GCM shared key
	if (recipientIds.length > 2) {
		try {
			// Fetch current members to detect membership changes
			const currentMembers = await api.getConversationMembers(conversationId);
			const sortedMembers = [...currentMembers].sort();
			const previousMembers = groupKeyMembers.get(conversationId);

			// Check if rotation needed: no key, or membership changed
			let groupKey = await store.loadGroupKey(conversationId);
			const needsRotation = !groupKey ||
				!previousMembers ||
				previousMembers.length !== sortedMembers.length ||
				previousMembers.some((m, i) => m !== sortedMembers[i]);

			if (needsRotation) {
				groupKey = await generateGroupKey();
				await store.storeGroupKey(conversationId, groupKey);
				const keyB64 = await exportGroupKey(groupKey);
				const currentOthers = currentMembers.filter((id) => id !== currentUserId);

				// Distribute key to each current member via pairwise Signal session
				for (const recipientId of currentOthers) {
					await ensureSession(recipientId);
					const { ciphertext, messageType: _mt } = await encryptMessage(store, recipientId, keyB64);
					sendWsMessage({
						type: 'send_message',
						conversation_id: conversationId,
						content: null,
						image_url: null,
						ciphertext,
						nonce: null,
						message_type: MSG_TYPE_GROUP_KEY_DISTRIBUTION
					});
				}
				groupKeyMembers.set(conversationId, sortedMembers);
			}

			// Encrypt message with group key
			const { ciphertext, nonce } = await encryptGroupMessage(groupKey!, plaintext);
			sendWsMessage({
				type: 'send_message',
				conversation_id: conversationId,
				content: null,
				image_url: imageUrl ?? null,
				ciphertext,
				nonce,
				message_type: MSG_TYPE_GROUP_MESSAGE
			});
			return;
		} catch (e) {
			console.error('Group encryption failed:', e);
			throw new Error('Encryption failed. Message not sent.');
		}
	}

	// DM (2-person): pairwise Signal encryption
	for (const recipientId of others) {
		try {
			await ensureSession(recipientId);
			const { ciphertext, messageType } = await encryptMessage(store, recipientId, plaintext);
			// Cache plaintext for own message lookup
			await store.storeSentMessage(ciphertext, plaintext);
			sendWsMessage({
				type: 'send_message',
				conversation_id: conversationId,
				content: null,
				image_url: imageUrl ?? null,
				ciphertext,
				nonce: null,
				message_type: messageType
			});
		} catch (e) {
			console.error('Encryption failed for', recipientId, e);
			throw new Error('Encryption failed. Message not sent.');
		}
	}

	// Self-chat: encrypt with group key (sender can decrypt own group messages)
	if (others.length === 0) {
		let groupKey = await store.loadGroupKey(conversationId);
		if (!groupKey) {
			groupKey = await generateGroupKey();
			await store.storeGroupKey(conversationId, groupKey);
		}
		const { ciphertext, nonce } = await encryptGroupMessage(groupKey, plaintext);
		sendWsMessage({
			type: 'send_message',
			conversation_id: conversationId,
			content: null,
			image_url: imageUrl ?? null,
			ciphertext,
			nonce,
			message_type: MSG_TYPE_GROUP_MESSAGE
		});
	}
}

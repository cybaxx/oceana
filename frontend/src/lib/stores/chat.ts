import { writable, get } from 'svelte/store';
import type { Conversation, Message, WsServerMessage, PreKeyBundleResponse } from '$lib/types';
import { api } from '$lib/api';
import { onWsMessage, sendWsMessage } from '$lib/ws';
import { getCryptoStore, encryptMessage, decryptMessage, initSession } from '$lib/crypto';

export const conversations = writable<Conversation[]>([]);
export const activeMessages = writable<Message[]>([]);
export const activeConversationId = writable<string | null>(null);

let unsubWs: (() => void) | null = null;

async function tryDecrypt(msg: Message): Promise<Message> {
	if (!msg.ciphertext || !msg.message_type) return msg;
	const store = getCryptoStore();
	if (!store) return msg;
	try {
		const plaintext = await decryptMessage(store, msg.sender_id, msg.ciphertext, msg.message_type);
		return { ...msg, plaintext };
	} catch (e) {
		console.error('Decryption failed for message', msg.id, e);
		return { ...msg, plaintext: '[Decryption failed]' };
	}
}

export function initChatListeners() {
	if (unsubWs) return;
	unsubWs = onWsMessage(async (msg: WsServerMessage) => {
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
	conversations.set(convs);
}

export async function loadMessages(conversationId: string) {
	activeConversationId.set(conversationId);
	const msgs = (await api.getMessages(conversationId)) as Message[];
	// Decrypt any encrypted messages
	const decrypted = await Promise.all(msgs.map(tryDecrypt));
	// API returns newest first, reverse for display
	activeMessages.set(decrypted.reverse());
}

// Session cache to avoid re-fetching bundles
const sessionInitialized = new Set<string>();

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

	// If no crypto store, fall back to plaintext
	if (!store) {
		sendWsMessage({
			type: 'send_message',
			conversation_id: conversationId,
			content: plaintext,
			image_url: imageUrl ?? null
		});
		return;
	}

	// For each recipient (excluding self), ensure session and encrypt
	const others = recipientIds.filter((id) => id !== currentUserId);

	for (const recipientId of others) {
		try {
			await ensureSession(recipientId);
			const { ciphertext, messageType } = await encryptMessage(store, recipientId, plaintext);
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
			// Fall back to plaintext
			sendWsMessage({
				type: 'send_message',
				conversation_id: conversationId,
				content: plaintext,
				image_url: imageUrl ?? null
			});
		}
	}

	// If it's a self-chat or we need to see our own message
	if (others.length === 0) {
		sendWsMessage({
			type: 'send_message',
			conversation_id: conversationId,
			content: plaintext,
			image_url: imageUrl ?? null
		});
	}
}

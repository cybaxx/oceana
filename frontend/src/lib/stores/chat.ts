import { writable, get } from 'svelte/store';
import type { Conversation, Message, WsServerMessage } from '$lib/types';
import { api } from '$lib/api';
import { onWsMessage } from '$lib/ws';

export const conversations = writable<Conversation[]>([]);
export const activeMessages = writable<Message[]>([]);
export const activeConversationId = writable<string | null>(null);

let unsubWs: (() => void) | null = null;

export function initChatListeners() {
	if (unsubWs) return;
	unsubWs = onWsMessage((msg: WsServerMessage) => {
		if (msg.type === 'new_message' && msg.message) {
			const message = {
				...msg.message,
				sender_username: msg.sender_username,
				sender_is_bot: msg.sender_is_bot ?? false
			};
			// If viewing this conversation, append
			if (get(activeConversationId) === message.conversation_id) {
				activeMessages.update((msgs) => [...msgs, message]);
			}
			// Update conversation list
			conversations.update((convs) => {
				const idx = convs.findIndex((c) => c.id === message.conversation_id);
				if (idx >= 0) {
					const conv = { ...convs[idx] };
					conv.last_message_text = message.plaintext;
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
	// API returns newest first, reverse for display
	activeMessages.set(msgs.reverse());
}

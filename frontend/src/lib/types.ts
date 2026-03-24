export interface User {
	id: string;
	username: string;
	email: string;
	display_name: string | null;
	bio: string | null;
	is_bot: boolean;
	avatar_url: string | null;
	created_at: string;
}

export interface Post {
	id: string;
	author_id: string;
	content: string;
	parent_id: string | null;
	signature?: string | null;
	created_at: string;
}

export interface PostWithAuthor extends Post {
	author_username: string;
	author_display_name: string | null;
	author_is_bot: boolean;
	reaction_counts: { emoji: string; count: number }[];
	user_reaction: string | null;
	reply_count: number;
	signature?: string | null;
	author_signing_key?: string | null;
	author_avatar_url?: string | null;
}

export interface AuthResponse {
	user: User;
	token: string;
}

export interface Conversation {
	id: string;
	created_at: string;
	last_message_text: string | null;
	last_message_at: string | null;
	last_message_sender_id: string | null;
}

export interface Message {
	id: string;
	conversation_id: string;
	sender_id: string;
	plaintext: string | null;
	ciphertext: string | null;
	nonce: string | null;
	message_type?: number | null;
	image_url: string | null;
	created_at: string;
	sender_username?: string;
	sender_is_bot?: boolean;
}

export interface PreKeyBundleResponse {
	user_id: string;
	identity_key: string;
	signed_prekey: string;
	signed_prekey_signature: string;
	signed_prekey_id: number;
	one_time_prekey: { key_id: number; public_key: string } | null;
}

// Message type constants
export const MSG_TYPE_GROUP_KEY_DISTRIBUTION = 100;
export const MSG_TYPE_GROUP_MESSAGE = 101;

export interface WsServerMessage {
	type: 'new_message' | 'typing' | 'error' | 'verify_identity';
	message?: Message;
	sender_username?: string;
	sender_is_bot?: boolean;
	conversation_id?: string;
	user_id?: string;
	username?: string;
	// verify_identity fields
	from_user_id?: string;
	from_username?: string;
}

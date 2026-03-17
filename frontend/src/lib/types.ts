export interface User {
	id: string;
	username: string;
	email: string;
	display_name: string | null;
	bio: string | null;
	created_at: string;
}

export interface Post {
	id: string;
	author_id: string;
	content: string;
	parent_id: string | null;
	created_at: string;
}

export interface PostWithAuthor extends Post {
	author_username: string;
	author_display_name: string | null;
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
	image_url: string | null;
	created_at: string;
}

export interface WsServerMessage {
	type: 'new_message' | 'typing' | 'error';
	message?: Message;
	sender_username?: string;
	conversation_id?: string;
	user_id?: string;
	username?: string;
}

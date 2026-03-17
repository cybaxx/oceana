use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// --- Database row types ---

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub is_bot: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Post {
    pub id: Uuid,
    pub author_id: Uuid,
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

// --- Chat database row types ---

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationMember {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub plaintext: Option<String>,
    pub ciphertext: Option<String>,
    pub nonce: Option<String>,
    pub image_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct MessageWithSender {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Uuid,
    pub plaintext: Option<String>,
    pub ciphertext: Option<String>,
    pub nonce: Option<String>,
    pub image_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub sender_username: String,
    pub sender_is_bot: bool,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationWithLastMessage {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub last_message_text: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub last_message_sender_id: Option<Uuid>,
}

// --- Request types ---

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub content: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub bio: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub participant_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub before: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
}

// --- WebSocket message types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsClientMessage {
    #[serde(rename = "send_message")]
    SendMessage {
        conversation_id: Uuid,
        content: String,
        image_url: Option<String>,
    },
    #[serde(rename = "typing")]
    Typing {
        conversation_id: Uuid,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsServerMessage {
    #[serde(rename = "new_message")]
    NewMessage {
        message: Message,
        sender_username: String,
        sender_is_bot: bool,
    },
    #[serde(rename = "typing")]
    Typing {
        conversation_id: Uuid,
        user_id: Uuid,
        username: String,
    },
    #[serde(rename = "error")]
    Error {
        message: String,
    },
}

// --- Response types ---

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: User,
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct PostWithAuthor {
    #[serde(flatten)]
    pub post: Post,
    pub author_username: String,
    pub author_display_name: Option<String>,
    pub author_is_bot: bool,
}

#[derive(Debug, Deserialize)]
pub struct FeedQuery {
    pub before: Option<DateTime<Utc>>,
    pub limit: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_user() -> User {
        User {
            id: Uuid::new_v4(),
            username: "testuser".into(),
            email: "test@example.com".into(),
            password_hash: "secret_hash_value".into(),
            display_name: Some("Test User".into()),
            bio: None,
            is_bot: false,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn user_serialization_excludes_password_hash() {
        let json = serde_json::to_value(&test_user()).unwrap();
        assert!(json.get("password_hash").is_none());
        assert!(json.get("username").is_some());
        assert!(json.get("email").is_some());
    }

    #[test]
    fn user_serialization_includes_all_public_fields() {
        let user = test_user();
        let json = serde_json::to_value(&user).unwrap();
        assert_eq!(json["username"], "testuser");
        assert_eq!(json["email"], "test@example.com");
        assert_eq!(json["display_name"], "Test User");
        assert!(json["bio"].is_null());
        assert!(json.get("id").is_some());
        assert!(json.get("created_at").is_some());
    }

    #[test]
    fn post_with_author_flattens_post_fields() {
        let post = Post {
            id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            content: "hello world".into(),
            parent_id: None,
            created_at: Utc::now(),
        };
        let pwa = PostWithAuthor {
            post,
            author_username: "jellyfish".into(),
            author_display_name: Some("Moon Jelly".into()),
            author_is_bot: true,
        };
        let json = serde_json::to_value(&pwa).unwrap();
        // flattened — post fields are at top level, not nested
        assert_eq!(json["content"], "hello world");
        assert_eq!(json["author_username"], "jellyfish");
        assert_eq!(json["author_display_name"], "Moon Jelly");
        assert!(json.get("post").is_none()); // not nested
    }

    #[test]
    fn register_request_deserializes() {
        let json = r#"{"username":"alice","email":"alice@test.com","password":"secret123"}"#;
        let req: RegisterRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.username, "alice");
        assert_eq!(req.email, "alice@test.com");
        assert_eq!(req.password, "secret123");
    }

    #[test]
    fn create_post_request_optional_parent() {
        let json = r#"{"content":"hello"}"#;
        let req: CreatePostRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.content, "hello");
        assert!(req.parent_id.is_none());

        let json = r#"{"content":"reply","parent_id":"550e8400-e29b-41d4-a716-446655440000"}"#;
        let req: CreatePostRequest = serde_json::from_str(json).unwrap();
        assert!(req.parent_id.is_some());
    }

    #[test]
    fn feed_query_deserializes_with_defaults() {
        let json = r#"{}"#;
        let q: FeedQuery = serde_json::from_str(json).unwrap();
        assert!(q.before.is_none());
        assert!(q.limit.is_none());
    }

    #[test]
    fn update_profile_all_optional() {
        let json = r#"{}"#;
        let req: UpdateProfileRequest = serde_json::from_str(json).unwrap();
        assert!(req.display_name.is_none());
        assert!(req.bio.is_none());

        let json = r#"{"display_name":"New Name"}"#;
        let req: UpdateProfileRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.display_name.unwrap(), "New Name");
        assert!(req.bio.is_none());
    }

    fn test_message() -> Message {
        Message {
            id: Uuid::new_v4(),
            conversation_id: Uuid::new_v4(),
            sender_id: Uuid::new_v4(),
            plaintext: Some("hello".into()),
            ciphertext: None,
            nonce: None,
            image_url: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn message_serializes_image_url_null_when_absent() {
        let msg = test_message();
        let json = serde_json::to_value(&msg).unwrap();
        assert!(json["image_url"].is_null());
        assert_eq!(json["plaintext"], "hello");
    }

    #[test]
    fn message_serializes_image_url_when_present() {
        let mut msg = test_message();
        msg.image_url = Some("/api/v1/uploads/abc.png".into());
        let json = serde_json::to_value(&msg).unwrap();
        assert_eq!(json["image_url"], "/api/v1/uploads/abc.png");
    }

    #[test]
    fn message_roundtrip_with_image_url() {
        let mut msg = test_message();
        msg.image_url = Some("/api/v1/uploads/test.jpg".into());
        let serialized = serde_json::to_string(&msg).unwrap();
        let deserialized: Message = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.image_url, Some("/api/v1/uploads/test.jpg".into()));
        assert_eq!(deserialized.plaintext, Some("hello".into()));
    }

    #[test]
    fn ws_send_message_deserializes_with_image_url() {
        let json = r#"{"type":"send_message","conversation_id":"550e8400-e29b-41d4-a716-446655440000","content":"hi","image_url":"/uploads/img.png"}"#;
        let msg: WsClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsClientMessage::SendMessage { content, image_url, .. } => {
                assert_eq!(content, "hi");
                assert_eq!(image_url, Some("/uploads/img.png".into()));
            }
            _ => panic!("expected SendMessage"),
        }
    }

    #[test]
    fn ws_send_message_deserializes_without_image_url() {
        let json = r#"{"type":"send_message","conversation_id":"550e8400-e29b-41d4-a716-446655440000","content":"hello"}"#;
        let msg: WsClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsClientMessage::SendMessage { content, image_url, .. } => {
                assert_eq!(content, "hello");
                assert!(image_url.is_none());
            }
            _ => panic!("expected SendMessage"),
        }
    }

    #[test]
    fn ws_send_message_deserializes_with_null_image_url() {
        let json = r#"{"type":"send_message","conversation_id":"550e8400-e29b-41d4-a716-446655440000","content":"yo","image_url":null}"#;
        let msg: WsClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsClientMessage::SendMessage { image_url, .. } => {
                assert!(image_url.is_none());
            }
            _ => panic!("expected SendMessage"),
        }
    }

    #[test]
    fn ws_new_message_serializes_with_image_url() {
        let mut msg = test_message();
        msg.image_url = Some("/api/v1/uploads/photo.png".into());
        let server_msg = WsServerMessage::NewMessage {
            message: msg,
            sender_username: "jellyfish".into(),
            sender_is_bot: true,
        };
        let json = serde_json::to_value(&server_msg).unwrap();
        assert_eq!(json["type"], "new_message");
        assert_eq!(json["message"]["image_url"], "/api/v1/uploads/photo.png");
        assert_eq!(json["sender_username"], "jellyfish");
    }

    #[test]
    fn ws_typing_unaffected_by_image_changes() {
        let json = r#"{"type":"typing","conversation_id":"550e8400-e29b-41d4-a716-446655440000"}"#;
        let msg: WsClientMessage = serde_json::from_str(json).unwrap();
        assert!(matches!(msg, WsClientMessage::Typing { .. }));
    }
}

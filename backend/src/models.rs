use base64::Engine;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// --- Database row types ---

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    #[serde(skip_serializing)]
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub is_bot: bool,
    pub avatar_url: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Post {
    pub id: Uuid,
    pub author_id: Uuid,
    pub content: String,
    pub parent_id: Option<Uuid>,
    pub signature: Option<String>,
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
    pub message_type: Option<i32>,
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
    pub message_type: Option<i32>,
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
    pub signature: Option<String>,
}

// --- Signal Protocol key types ---

#[derive(Debug, Deserialize)]
pub struct OneTimePreKey {
    pub key_id: i32,
    pub public_key: String,
}

#[derive(Debug, Deserialize)]
pub struct UploadKeyBundleRequest {
    pub identity_key: String,
    pub signed_prekey: String,
    pub signed_prekey_signature: String,
    pub signed_prekey_id: i32,
    pub one_time_prekeys: Vec<OneTimePreKey>,
    pub signing_key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OneTimePreKeyResponse {
    pub key_id: i32,
    pub public_key: String,
}

#[derive(Debug, Serialize)]
pub struct PreKeyBundleResponse {
    pub user_id: Uuid,
    pub identity_key: String,
    pub signed_prekey: String,
    pub signed_prekey_signature: String,
    pub signed_prekey_id: i32,
    pub one_time_prekey: Option<OneTimePreKeyResponse>,
}

#[derive(Debug, Serialize)]
pub struct PreKeyCountResponse {
    pub count: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub bio: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReactRequest {
    pub kind: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ReactionCounts {
    pub reactions: Vec<ReactionCount>,
    pub user_reaction: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ReactionCount {
    pub emoji: String,
    pub count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub participant_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CursorQuery {
    pub cursor: Option<String>,
    pub limit: Option<i64>,
}

// --- WebSocket message types ---

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsClientMessage {
    #[serde(rename = "send_message")]
    SendMessage {
        conversation_id: Uuid,
        content: Option<String>,
        image_url: Option<String>,
        ciphertext: Option<String>,
        nonce: Option<String>,
        message_type: Option<i32>,
    },
    #[serde(rename = "typing")]
    Typing {
        conversation_id: Uuid,
    },
    #[serde(rename = "verify_identity")]
    VerifyIdentity {
        target_user_id: Uuid,
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
    #[serde(rename = "verify_identity")]
    VerifyIdentity {
        from_user_id: Uuid,
        from_username: String,
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
    pub reaction_counts: serde_json::Value,
    pub user_reaction: Option<String>,
    pub reply_count: i64,
    pub author_signing_key: Option<String>,
    pub author_avatar_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub next_cursor: Option<String>,
}

pub fn encode_cursor(created_at: &DateTime<Utc>, id: &Uuid) -> String {
    let raw = format!("{}|{}", created_at.to_rfc3339(), id);
    base64::engine::general_purpose::STANDARD.encode(raw)
}

pub fn decode_cursor(s: &str) -> Result<(DateTime<Utc>, Uuid), String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| format!("Invalid cursor: {e}"))?;
    let raw = String::from_utf8(bytes).map_err(|e| format!("Invalid cursor: {e}"))?;
    let (ts_str, id_str) = raw.split_once('|').ok_or("Invalid cursor format")?;
    let ts = DateTime::parse_from_rfc3339(ts_str)
        .map_err(|e| format!("Invalid cursor timestamp: {e}"))?
        .with_timezone(&Utc);
    let id = Uuid::parse_str(id_str).map_err(|e| format!("Invalid cursor id: {e}"))?;
    Ok((ts, id))
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct UserSearchResult {
    pub id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub is_bot: bool,
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
            avatar_url: None,
            created_at: Utc::now(),
        }
    }

    #[test]
    fn user_serialization_excludes_password_hash() {
        let json = serde_json::to_value(&test_user()).unwrap();
        assert!(json.get("password_hash").is_none());
        assert!(json.get("username").is_some());
        assert!(json.get("email").is_none());
    }

    #[test]
    fn user_serialization_includes_all_public_fields() {
        let user = test_user();
        let json = serde_json::to_value(&user).unwrap();
        assert_eq!(json["username"], "testuser");
        assert!(json.get("email").is_none());
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
            signature: None,
            created_at: Utc::now(),
        };
        let pwa = PostWithAuthor {
            post,
            author_username: "jellyfish".into(),
            author_display_name: Some("Moon Jelly".into()),
            author_is_bot: true,
            reaction_counts: serde_json::json!([]),
            user_reaction: None,
            reply_count: 0,
            author_signing_key: None,
            author_avatar_url: None,
        };
        let json = serde_json::to_value(&pwa).unwrap();
        // flattened — post fields are at top level, not nested
        assert_eq!(json["content"], "hello world");
        assert_eq!(json["author_username"], "jellyfish");
        assert_eq!(json["author_display_name"], "Moon Jelly");
        assert!(json.get("post").is_none()); // not nested
        assert_eq!(json["reaction_counts"], serde_json::json!([]));
        assert!(json["user_reaction"].is_null());
    }

    #[test]
    fn post_with_author_reaction_counts_with_data() {
        let post = Post {
            id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            content: "test".into(),
            parent_id: None,
            signature: None,
            created_at: Utc::now(),
        };
        let pwa = PostWithAuthor {
            post,
            author_username: "alice".into(),
            author_display_name: None,
            author_is_bot: false,
            reaction_counts: serde_json::json!([
                {"emoji": "🔥", "count": 3},
                {"emoji": "🧠", "count": 1}
            ]),
            user_reaction: Some("🔥".into()),
            reply_count: 0,
            author_signing_key: None,
            author_avatar_url: None,
        };
        let json = serde_json::to_value(&pwa).unwrap();
        let counts = json["reaction_counts"].as_array().unwrap();
        assert_eq!(counts.len(), 2);
        assert_eq!(counts[0]["emoji"], "🔥");
        assert_eq!(counts[0]["count"], 3);
        assert_eq!(counts[1]["emoji"], "🧠");
        assert_eq!(counts[1]["count"], 1);
        assert_eq!(json["user_reaction"], "🔥");
    }

    #[test]
    fn post_with_author_no_likes_yikes_fields() {
        let post = Post {
            id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            content: "test".into(),
            parent_id: None,
            signature: None,
            created_at: Utc::now(),
        };
        let pwa = PostWithAuthor {
            post,
            author_username: "bob".into(),
            author_display_name: None,
            author_is_bot: true,
            reaction_counts: serde_json::json!([]),
            user_reaction: None,
            reply_count: 0,
            author_signing_key: None,
            author_avatar_url: None,
        };
        let json = serde_json::to_value(&pwa).unwrap();
        assert!(json.get("likes").is_none());
        assert!(json.get("yikes").is_none());
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
    fn create_post_request_with_signature() {
        let json = r#"{"content":"signed post","signature":"base64sig=="}"#;
        let req: CreatePostRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.content, "signed post");
        assert_eq!(req.signature.unwrap(), "base64sig==");
        assert!(req.parent_id.is_none());
    }

    #[test]
    fn create_post_request_signed_reply() {
        let json = r#"{"content":"reply","parent_id":"550e8400-e29b-41d4-a716-446655440000","signature":"sig=="}"#;
        let req: CreatePostRequest = serde_json::from_str(json).unwrap();
        assert!(req.parent_id.is_some());
        assert!(req.signature.is_some());
    }

    #[test]
    fn post_with_author_includes_signing_key() {
        let post = Post {
            id: Uuid::new_v4(),
            author_id: Uuid::new_v4(),
            content: "signed".into(),
            parent_id: None,
            signature: Some("sig==".into()),
            created_at: Utc::now(),
        };
        let pwa = PostWithAuthor {
            post,
            author_username: "alice".into(),
            author_display_name: None,
            author_is_bot: false,
            reaction_counts: serde_json::json!([]),
            user_reaction: None,
            reply_count: 5,
            author_signing_key: Some("pubkey==".into()),
            author_avatar_url: None,
        };
        let json = serde_json::to_value(&pwa).unwrap();
        assert_eq!(json["signature"], "sig==");
        assert_eq!(json["author_signing_key"], "pubkey==");
        assert_eq!(json["reply_count"], 5);
    }

    #[test]
    fn paginated_response_serializes() {
        let resp = PaginatedResponse {
            data: vec!["a".to_string(), "b".to_string()],
            next_cursor: Some("cursor123".into()),
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["data"][0], "a");
        assert_eq!(json["data"][1], "b");
        assert_eq!(json["next_cursor"], "cursor123");
    }

    #[test]
    fn paginated_response_null_cursor() {
        let resp: PaginatedResponse<String> = PaginatedResponse {
            data: vec![],
            next_cursor: None,
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert!(json["data"].as_array().unwrap().is_empty());
        assert!(json["next_cursor"].is_null());
    }

    #[test]
    fn user_search_result_serializes() {
        let r = UserSearchResult {
            id: Uuid::new_v4(),
            username: "nautilus".into(),
            display_name: Some("Nautilus".into()),
            is_bot: true,
        };
        let json = serde_json::to_value(&r).unwrap();
        assert_eq!(json["username"], "nautilus");
        assert_eq!(json["is_bot"], true);
    }

    #[test]
    fn cursor_query_deserializes_with_defaults() {
        let json = r#"{}"#;
        let q: CursorQuery = serde_json::from_str(json).unwrap();
        assert!(q.cursor.is_none());
        assert!(q.limit.is_none());
    }

    #[test]
    fn cursor_encode_decode_roundtrip() {
        let ts = Utc::now();
        let id = Uuid::new_v4();
        let cursor = encode_cursor(&ts, &id);
        let (decoded_ts, decoded_id) = decode_cursor(&cursor).unwrap();
        assert_eq!(decoded_id, id);
        // Compare as RFC3339 strings since sub-nanosecond precision may differ
        assert_eq!(decoded_ts.to_rfc3339(), ts.to_rfc3339());
    }

    #[test]
    fn decode_cursor_rejects_invalid() {
        assert!(decode_cursor("not-base64!!!").is_err());
        // Valid base64 but bad format
        let bad = base64::engine::general_purpose::STANDARD.encode("no-pipe-here");
        assert!(decode_cursor(&bad).is_err());
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
            message_type: None,
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
                assert_eq!(content, Some("hi".into()));
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
                assert_eq!(content, Some("hello".into()));
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
    fn ws_send_message_deserializes_encrypted() {
        let json = r#"{"type":"send_message","conversation_id":"550e8400-e29b-41d4-a716-446655440000","ciphertext":"abc123","message_type":3}"#;
        let msg: WsClientMessage = serde_json::from_str(json).unwrap();
        match msg {
            WsClientMessage::SendMessage { content, ciphertext, message_type, .. } => {
                assert!(content.is_none());
                assert_eq!(ciphertext, Some("abc123".into()));
                assert_eq!(message_type, Some(3));
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

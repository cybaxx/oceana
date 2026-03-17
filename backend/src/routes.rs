use axum::extract::ws::{Message as WsMsg, WebSocket, WebSocketUpgrade};
use axum::extract::{Multipart, Path, Query, State};
use axum::routing::{get, post, put, delete};
use axum::{Json, Router};
use futures::{SinkExt, StreamExt};
use uuid::Uuid;

use crate::auth::{self, AuthUser};
use crate::error::AppError;
use crate::models::*;
use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        // Health
        .route("/health", get(health))
        // Auth
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        // Users
        .route("/users/:id", get(get_user))
        .route("/users/:id/follow", post(follow_user).delete(unfollow_user))
        .route("/profile", put(update_profile))
        // Posts
        .route("/posts", post(create_post))
        .route("/posts/:id", get(get_post))
        .route("/posts/:id", delete(delete_post))
        // Feed
        .route("/feed", get(get_feed))
        // Chat
        .route("/chats", post(create_conversation).get(list_conversations))
        .route("/chats/:id/messages", get(get_messages))
        // Uploads
        .route("/upload", post(upload_image))
        .route("/uploads/:filename", get(serve_upload))
        // WebSocket
        .route("/ws", get(ws_handler))
}

// --- Health ---

async fn health() -> &'static str {
    "ok"
}

// --- Auth ---

async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    if body.username.len() < 3 || body.username.len() > 32 {
        return Err(AppError::BadRequest("Username must be 3-32 characters".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::BadRequest("Password must be at least 8 characters".into()));
    }

    let password_hash = auth::hash_password(&body.password)?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(&body.username)
    .bind(&body.email)
    .bind(&password_hash)
    .fetch_one(&state.db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.constraint().is_some() => {
            AppError::Conflict("Username or email already taken".into())
        }
        _ => AppError::Internal(e.to_string()),
    })?;

    let token = auth::create_token(user.id, &user.username, &state.jwt_secret)?;
    Ok(Json(AuthResponse { user, token }))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&body.email)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid credentials".into()))?;

    if !auth::verify_password(&body.password, &user.password_hash)? {
        return Err(AppError::Unauthorized("Invalid credentials".into()));
    }

    let token = auth::create_token(user.id, &user.username, &state.jwt_secret)?;
    Ok(Json(AuthResponse { user, token }))
}

// --- Users ---

async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<User>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;
    Ok(Json(user))
}

async fn update_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<User>, AppError> {
    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET display_name = COALESCE($1, display_name), bio = COALESCE($2, bio) WHERE id = $3 RETURNING *"
    )
    .bind(&body.display_name)
    .bind(&body.bio)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(user))
}

// --- Follow ---

async fn follow_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    if auth.user_id == id {
        return Err(AppError::BadRequest("Cannot follow yourself".into()));
    }
    sqlx::query("INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING")
        .bind(auth.user_id)
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "status": "following" })))
}

async fn unfollow_user(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2")
        .bind(auth.user_id)
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "status": "unfollowed" })))
}

// --- Posts ---

async fn create_post(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePostRequest>,
) -> Result<Json<Post>, AppError> {
    if body.content.is_empty() || body.content.len() > 10_000 {
        return Err(AppError::BadRequest("Post content must be 1-10000 characters".into()));
    }
    let post = sqlx::query_as::<_, Post>(
        "INSERT INTO posts (author_id, content, parent_id) VALUES ($1, $2, $3) RETURNING *"
    )
    .bind(auth.user_id)
    .bind(&body.content)
    .bind(body.parent_id)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(post))
}

async fn get_post(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Post>, AppError> {
    let post = sqlx::query_as::<_, Post>("SELECT * FROM posts WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("Post not found".into()))?;
    Ok(Json(post))
}

async fn delete_post(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let result = sqlx::query("DELETE FROM posts WHERE id = $1 AND author_id = $2")
        .bind(id)
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Post not found or not owned by you".into()));
    }
    Ok(Json(serde_json::json!({ "status": "deleted" })))
}

// --- Feed ---

async fn get_feed(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<FeedQuery>,
) -> Result<Json<Vec<PostWithAuthor>>, AppError> {
    let limit = params.limit.unwrap_or(20).min(50);
    let before = params.before.unwrap_or_else(|| chrono::Utc::now());

    // Posts from people you follow, plus your own, newest first
    let rows = sqlx::query_as::<_, PostWithAuthorRow>(
        r#"
        SELECT p.id, p.author_id, p.content, p.parent_id, p.created_at,
               u.username AS author_username, u.display_name AS author_display_name,
               u.is_bot AS author_is_bot
        FROM posts p
        JOIN users u ON u.id = p.author_id
        WHERE (p.author_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
               OR p.author_id = $1)
          AND p.created_at < $2
        ORDER BY p.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(auth.user_id)
    .bind(before)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    let posts = rows.into_iter().map(|r| PostWithAuthor {
        post: Post {
            id: r.id,
            author_id: r.author_id,
            content: r.content,
            parent_id: r.parent_id,
            created_at: r.created_at,
        },
        author_username: r.author_username,
        author_display_name: r.author_display_name,
        author_is_bot: r.author_is_bot,
    }).collect();

    Ok(Json(posts))
}

// --- Chat ---

async fn create_conversation(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateConversationRequest>,
) -> Result<Json<Conversation>, AppError> {
    if body.participant_ids.is_empty() {
        return Err(AppError::BadRequest("Must include at least one participant".into()));
    }

    let conv = sqlx::query_as::<_, Conversation>(
        "INSERT INTO conversations DEFAULT VALUES RETURNING *"
    )
    .fetch_one(&state.db)
    .await?;

    // Add the creator
    sqlx::query("INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)")
        .bind(conv.id)
        .bind(auth.user_id)
        .execute(&state.db)
        .await?;

    // Add other participants
    for uid in &body.participant_ids {
        if *uid != auth.user_id {
            sqlx::query("INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2)")
                .bind(conv.id)
                .bind(uid)
                .execute(&state.db)
                .await?;
        }
    }

    Ok(Json(conv))
}

async fn list_conversations(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<Vec<ConversationWithLastMessage>>, AppError> {
    let convs = sqlx::query_as::<_, ConversationWithLastMessage>(
        r#"
        SELECT c.id, c.created_at,
               m.plaintext AS last_message_text,
               m.created_at AS last_message_at,
               m.sender_id AS last_message_sender_id
        FROM conversations c
        JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
        LEFT JOIN LATERAL (
            SELECT plaintext, created_at, sender_id FROM messages
            WHERE conversation_id = c.id
            ORDER BY created_at DESC LIMIT 1
        ) m ON true
        ORDER BY COALESCE(m.created_at, c.created_at) DESC
        "#,
    )
    .bind(auth.user_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(convs))
}

async fn get_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(params): Query<MessagesQuery>,
) -> Result<Json<Vec<MessageWithSender>>, AppError> {
    // Verify user is a member
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2)"
    )
    .bind(id)
    .bind(auth.user_id)
    .fetch_one(&state.db)
    .await?;

    if !is_member {
        return Err(AppError::NotFound("Conversation not found".into()));
    }

    let limit = params.limit.unwrap_or(50).min(100);
    let before = params.before.unwrap_or_else(|| chrono::Utc::now());

    let messages = sqlx::query_as::<_, MessageWithSender>(
        r#"
        SELECT m.id, m.conversation_id, m.sender_id, m.plaintext, m.ciphertext, m.nonce, m.image_url, m.created_at,
               u.username AS sender_username, u.is_bot AS sender_is_bot
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1 AND m.created_at < $2
        ORDER BY m.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(id)
    .bind(before)
    .bind(limit)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(messages))
}

// --- Uploads ---

async fn upload_image(
    _auth: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<serde_json::Value>, AppError> {
    while let Some(field) = multipart.next_field().await.map_err(|e| AppError::BadRequest(e.to_string()))? {
        let content_type = field.content_type().unwrap_or("").to_string();
        let ext = validate_image_content_type(&content_type)
            .map_err(AppError::BadRequest)?;

        let data = field.bytes().await.map_err(|e| AppError::BadRequest(e.to_string()))?;

        if data.len() > 10 * 1024 * 1024 {
            return Err(AppError::BadRequest("File too large (max 10MB)".into()));
        }

        let filename = format!("{}.{}", Uuid::new_v4(), ext);
        let path = format!("/uploads/{filename}");
        tokio::fs::write(&path, &data).await.map_err(|e| AppError::Internal(e.to_string()))?;

        return Ok(Json(serde_json::json!({ "url": format!("/api/v1/uploads/{filename}") })));
    }

    Err(AppError::BadRequest("No file provided".into()))
}

async fn serve_upload(
    Path(filename): Path<String>,
) -> Result<axum::response::Response, AppError> {
    validate_upload_filename(&filename).map_err(AppError::BadRequest)?;

    let path = format!("/uploads/{filename}");
    let data = tokio::fs::read(&path).await.map_err(|_| AppError::NotFound("File not found".into()))?;

    let content_type = content_type_for_extension(&path);

    Ok(axum::response::Response::builder()
        .header("Content-Type", content_type)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .body(axum::body::Body::from(data))
        .unwrap())
}

// --- WebSocket ---

#[derive(serde::Deserialize)]
struct WsQuery {
    token: String,
}

async fn ws_handler(
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Result<axum::response::Response, AppError> {
    let claims = auth::verify_token(&query.token, &state.jwt_secret)?;
    let user_id = claims.sub;
    let username = claims.username;

    let is_bot = sqlx::query_scalar::<_, bool>("SELECT is_bot FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false);

    Ok(ws.on_upgrade(move |socket| handle_ws(socket, state, user_id, username, is_bot)))
}

async fn handle_ws(socket: WebSocket, state: AppState, user_id: Uuid, username: String, is_bot: bool) {
    let (mut ws_sink, mut ws_stream) = socket.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<WsServerMessage>();

    state.connections.connect(user_id, tx.clone());

    // Task: forward server messages to WebSocket
    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if ws_sink.send(WsMsg::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    // Receive messages from client
    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            WsMsg::Text(text) => {
                if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(&text) {
                    match client_msg {
                        WsClientMessage::SendMessage { conversation_id, content, image_url } => {
                            handle_send_message(&state, user_id, &username, is_bot, conversation_id, content, image_url).await;
                        }
                        WsClientMessage::Typing { conversation_id } => {
                            handle_typing(&state, user_id, &username, conversation_id).await;
                        }
                    }
                }
            }
            WsMsg::Close(_) => break,
            _ => {}
        }
    }

    state.connections.disconnect(user_id, &tx);
    send_task.abort();
}

async fn handle_send_message(
    state: &AppState,
    sender_id: Uuid,
    sender_username: &str,
    sender_is_bot: bool,
    conversation_id: Uuid,
    content: String,
    image_url: Option<String>,
) {
    // Verify membership
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2)"
    )
    .bind(conversation_id)
    .bind(sender_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if !is_member {
        return;
    }

    // Store message
    let message = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (conversation_id, sender_id, plaintext, image_url) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(conversation_id)
    .bind(sender_id)
    .bind(&content)
    .bind(&image_url)
    .fetch_one(&state.db)
    .await;

    let message = match message {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Failed to store message: {e}");
            return;
        }
    };

    // Get all conversation members and relay
    let members: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1"
    )
    .bind(conversation_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let server_msg = WsServerMessage::NewMessage {
        message,
        sender_username: sender_username.to_string(),
        sender_is_bot,
    };

    for member_id in members {
        state.connections.send_to_user(member_id, &server_msg);
    }
}

async fn handle_typing(
    state: &AppState,
    user_id: Uuid,
    username: &str,
    conversation_id: Uuid,
) {
    let members: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1"
    )
    .bind(conversation_id)
    .fetch_all(&state.db)
    .await
    .unwrap_or_default();

    let msg = WsServerMessage::Typing {
        conversation_id,
        user_id,
        username: username.to_string(),
    };

    for member_id in members {
        if member_id != user_id {
            state.connections.send_to_user(member_id, &msg);
        }
    }
}

// --- Upload validation helpers (for testing) ---

fn validate_image_content_type(content_type: &str) -> Result<&'static str, String> {
    match content_type {
        "image/jpeg" => Ok("jpg"),
        "image/png" => Ok("png"),
        "image/gif" => Ok("gif"),
        "image/webp" => Ok("webp"),
        _ => Err(format!("Unsupported image type: {content_type}")),
    }
}

fn validate_upload_filename(filename: &str) -> Result<(), String> {
    if filename.contains('/') || filename.contains("..") {
        Err("Invalid filename".into())
    } else {
        Ok(())
    }
}

fn content_type_for_extension(path: &str) -> &'static str {
    match path.rsplit('.').next() {
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("png") => "image/png",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        _ => "application/octet-stream",
    }
}

// Helper row type for the feed join query
#[derive(sqlx::FromRow)]
struct PostWithAuthorRow {
    id: Uuid,
    author_id: Uuid,
    content: String,
    parent_id: Option<Uuid>,
    created_at: chrono::DateTime<chrono::Utc>,
    author_username: String,
    author_display_name: Option<String>,
    author_is_bot: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- validate_image_content_type ---

    #[test]
    fn accepts_jpeg() {
        assert_eq!(validate_image_content_type("image/jpeg").unwrap(), "jpg");
    }

    #[test]
    fn accepts_png() {
        assert_eq!(validate_image_content_type("image/png").unwrap(), "png");
    }

    #[test]
    fn accepts_gif() {
        assert_eq!(validate_image_content_type("image/gif").unwrap(), "gif");
    }

    #[test]
    fn accepts_webp() {
        assert_eq!(validate_image_content_type("image/webp").unwrap(), "webp");
    }

    #[test]
    fn rejects_text_plain() {
        let err = validate_image_content_type("text/plain").unwrap_err();
        assert!(err.contains("Unsupported image type"));
    }

    #[test]
    fn rejects_application_pdf() {
        assert!(validate_image_content_type("application/pdf").is_err());
    }

    #[test]
    fn rejects_empty_content_type() {
        assert!(validate_image_content_type("").is_err());
    }

    #[test]
    fn rejects_image_svg() {
        assert!(validate_image_content_type("image/svg+xml").is_err());
    }

    // --- validate_upload_filename ---

    #[test]
    fn valid_filename_accepted() {
        assert!(validate_upload_filename("abc-123.png").is_ok());
    }

    #[test]
    fn uuid_filename_accepted() {
        assert!(validate_upload_filename("550e8400-e29b-41d4-a716-446655440000.jpg").is_ok());
    }

    #[test]
    fn rejects_directory_traversal_dots() {
        assert!(validate_upload_filename("../etc/passwd").is_err());
    }

    #[test]
    fn rejects_directory_traversal_slash() {
        assert!(validate_upload_filename("foo/bar.png").is_err());
    }

    #[test]
    fn rejects_double_dot_in_middle() {
        assert!(validate_upload_filename("a..b").is_err());
    }

    // --- content_type_for_extension ---

    #[test]
    fn extension_jpg_returns_jpeg() {
        assert_eq!(content_type_for_extension("photo.jpg"), "image/jpeg");
    }

    #[test]
    fn extension_jpeg_returns_jpeg() {
        assert_eq!(content_type_for_extension("photo.jpeg"), "image/jpeg");
    }

    #[test]
    fn extension_png_returns_png() {
        assert_eq!(content_type_for_extension("img.png"), "image/png");
    }

    #[test]
    fn extension_gif_returns_gif() {
        assert_eq!(content_type_for_extension("anim.gif"), "image/gif");
    }

    #[test]
    fn extension_webp_returns_webp() {
        assert_eq!(content_type_for_extension("pic.webp"), "image/webp");
    }

    #[test]
    fn unknown_extension_returns_octet_stream() {
        assert_eq!(content_type_for_extension("file.bin"), "application/octet-stream");
    }

    #[test]
    fn no_extension_returns_octet_stream() {
        assert_eq!(content_type_for_extension("noext"), "application/octet-stream");
    }

    #[test]
    fn full_path_uses_last_extension() {
        assert_eq!(content_type_for_extension("/uploads/abc.png"), "image/png");
    }
}

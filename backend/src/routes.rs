use axum::extract::ws::{Message as WsMsg, WebSocket, WebSocketUpgrade};
use axum::extract::{Multipart, Path, Query, State};
use axum::routing::{get, post, put, delete};
use axum::{Json, Router};
use futures::{SinkExt, StreamExt};
use std::time::Instant;
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
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        // Users
        .route("/users/search", get(search_users))
        .route("/users/:id", get(get_user))
        .route("/users/:id/followers", get(get_followers))
        .route("/users/:id/following", get(get_following))
        .route("/users/:id/follow", post(follow_user).delete(unfollow_user))
        .route("/profile", put(update_profile))
        // Posts
        .route("/posts", post(create_post))
        .route("/posts/:id", get(get_post).put(update_post).delete(delete_post))
        .route("/posts/:id/react", post(react_to_post).delete(unreact_to_post))
        .route("/posts/:id/reactions", get(get_reactions))
        .route("/posts/:id/replies", get(get_replies))
        // Feed
        .route("/feed", get(get_feed))
        // Chat
        .route("/chats", post(create_conversation).get(list_conversations))
        .route("/chats/:id", put(update_conversation))
        .route("/chats/:id/messages", get(get_messages))
        // Signal keys
        .route("/keys/bundle", put(upload_key_bundle))
        .route("/keys/bundle/:user_id", get(get_key_bundle))
        .route("/keys/count", get(get_key_count))
        // Conversation members
        .route("/chats/:id/members", get(get_conversation_members))
        // Uploads
        .route("/upload", post(upload_image))
        .route("/uploads/:filename", get(serve_upload))
        // WebSocket
        .route("/ws/ticket", post(create_ws_ticket))
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
    validate_username(&body.username).map_err(AppError::BadRequest)?;
    validate_password(&body.password).map_err(AppError::BadRequest)?;
    validate_email(&body.email).map_err(AppError::BadRequest)?;

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
    let refresh_token = auth::create_refresh_token(&state.db, user.id).await?;
    Ok(Json(AuthResponse { user, token, refresh_token }))
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
    let refresh_token = auth::create_refresh_token(&state.db, user.id).await?;
    Ok(Json(AuthResponse { user, token, refresh_token }))
}

async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> Result<Json<RefreshResponse>, AppError> {
    let (user_id, username) = auth::validate_refresh_token(&state.db, &body.refresh_token)
        .await?
        .ok_or_else(|| AppError::Unauthorized("Invalid or expired refresh token".into()))?;

    // Rotate: delete old token
    auth::revoke_refresh_token(&state.db, &body.refresh_token).await?;

    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await?;

    let token = auth::create_token(user_id, &username, &state.jwt_secret)?;
    let new_refresh_token = auth::create_refresh_token(&state.db, user_id).await?;

    Ok(Json(RefreshResponse {
        user,
        token,
        refresh_token: new_refresh_token,
    }))
}

async fn logout(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    auth::revoke_user_refresh_tokens(&state.db, auth_user.user_id).await?;
    Ok(Json(serde_json::json!({ "status": "logged_out" })))
}

// --- Users ---

async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| AppError::NotFound("User not found".into()))?;

    let follower_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM follows WHERE followed_id = $1")
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    let following_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM follows WHERE follower_id = $1")
        .bind(id)
        .fetch_one(&state.db)
        .await?;

    let mut json = serde_json::to_value(&user).unwrap();
    json["follower_count"] = serde_json::json!(follower_count);
    json["following_count"] = serde_json::json!(following_count);
    Ok(Json(json))
}

async fn search_users(
    State(state): State<AppState>,
    _auth: AuthUser,
    Query(params): Query<SearchQuery>,
) -> Result<Json<Vec<UserSearchResult>>, AppError> {
    let pattern = format!("%{}%", params.q);
    let users = sqlx::query_as::<_, UserSearchResult>(
        "SELECT id, username, display_name, is_bot FROM users WHERE username ILIKE $1 OR display_name ILIKE $1 LIMIT 20"
    )
    .bind(&pattern)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(users))
}

async fn update_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileRequest>,
) -> Result<Json<User>, AppError> {
    if let Some(ref name) = body.display_name {
        if name.len() > 64 {
            return Err(AppError::BadRequest("Display name must be at most 64 characters".into()));
        }
    }
    if let Some(ref bio) = body.bio {
        if bio.len() > 500 {
            return Err(AppError::BadRequest("Bio must be at most 500 characters".into()));
        }
    }

    let user = sqlx::query_as::<_, User>(
        "UPDATE users SET display_name = COALESCE($1, display_name), bio = COALESCE($2, bio), avatar_url = COALESCE($3, avatar_url) WHERE id = $4 RETURNING *"
    )
    .bind(&body.display_name)
    .bind(&body.bio)
    .bind(&body.avatar_url)
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

async fn get_followers(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<UserSearchResult>>, AppError> {
    let users = sqlx::query_as::<_, UserSearchResult>(
        "SELECT u.id, u.username, u.display_name, u.is_bot FROM users u JOIN follows f ON f.follower_id = u.id WHERE f.followed_id = $1 ORDER BY u.username"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(users))
}

async fn get_following(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<UserSearchResult>>, AppError> {
    let users = sqlx::query_as::<_, UserSearchResult>(
        "SELECT u.id, u.username, u.display_name, u.is_bot FROM users u JOIN follows f ON f.followed_id = u.id WHERE f.follower_id = $1 ORDER BY u.username"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;
    Ok(Json(users))
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
        "INSERT INTO posts (author_id, content, parent_id, signature) VALUES ($1, $2, $3, $4) RETURNING *"
    )
    .bind(auth.user_id)
    .bind(&body.content)
    .bind(body.parent_id)
    .bind(&body.signature)
    .fetch_one(&state.db)
    .await?;
    Ok(Json(post))
}

async fn get_post(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<PostWithAuthor>, AppError> {
    let row = sqlx::query_as::<_, PostWithAuthorRow>(
        r#"
        SELECT p.id, p.author_id, p.content, p.parent_id, p.signature, p.created_at, p.updated_at,
               u.username AS author_username, u.display_name AS author_display_name,
               u.is_bot AS author_is_bot,
               u.signing_key AS author_signing_key,
               u.avatar_url AS author_avatar_url,
               COALESCE((SELECT json_agg(json_build_object('emoji', sub.kind, 'count', sub.cnt))
                 FROM (SELECT kind, COUNT(*) AS cnt FROM reactions WHERE post_id = p.id GROUP BY kind) sub
               ), '[]'::json) AS reaction_counts,
               (SELECT kind FROM reactions WHERE post_id = p.id AND user_id = $2) AS user_reaction,
               (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
        FROM posts p
        JOIN users u ON u.id = p.author_id
        WHERE p.id = $1
        "#,
    )
    .bind(id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Post not found".into()))?;

    Ok(Json(PostWithAuthor {
        post: Post {
            id: row.id,
            author_id: row.author_id,
            content: row.content,
            parent_id: row.parent_id,
            signature: row.signature,
            created_at: row.created_at,
            updated_at: row.updated_at,
        },
        author_username: row.author_username,
        author_display_name: row.author_display_name,
        author_is_bot: row.author_is_bot,
        reaction_counts: row.reaction_counts,
        user_reaction: row.user_reaction,
        reply_count: row.reply_count,
        author_signing_key: row.author_signing_key,
        author_avatar_url: row.author_avatar_url,
    }))
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

async fn update_post(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePostRequest>,
) -> Result<Json<Post>, AppError> {
    if body.content.is_empty() || body.content.len() > 10_000 {
        return Err(AppError::BadRequest("Post content must be 1-10000 characters".into()));
    }
    let post = sqlx::query_as::<_, Post>(
        "UPDATE posts SET content = $1, signature = $2, updated_at = NOW() WHERE id = $3 AND author_id = $4 RETURNING *"
    )
    .bind(&body.content)
    .bind(&body.signature)
    .bind(id)
    .bind(auth.user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("Post not found or not owned by you".into()))?;
    Ok(Json(post))
}

// --- Reactions ---

async fn react_to_post(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<ReactRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let body_kind = validate_emoji(&body.kind)
        .map_err(AppError::BadRequest)?;
    sqlx::query(
        "INSERT INTO reactions (user_id, post_id, kind) VALUES ($1, $2, $3) ON CONFLICT (user_id, post_id) DO UPDATE SET kind = $3"
    )
    .bind(auth.user_id)
    .bind(id)
    .bind(&body_kind)
    .execute(&state.db)
    .await?;
    Ok(Json(serde_json::json!({ "status": "ok", "kind": body_kind })))
}

async fn unreact_to_post(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    sqlx::query("DELETE FROM reactions WHERE user_id = $1 AND post_id = $2")
        .bind(auth.user_id)
        .bind(id)
        .execute(&state.db)
        .await?;
    Ok(Json(serde_json::json!({ "status": "removed" })))
}

async fn get_reactions(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>, AppError> {
    let reaction_counts: Vec<ReactionCountRow> = sqlx::query_as(
        "SELECT kind AS emoji, COUNT(*) AS count FROM reactions WHERE post_id = $1 GROUP BY kind"
    ).bind(id).fetch_all(&state.db).await?;
    let user_reaction: Option<String> = sqlx::query_scalar("SELECT kind FROM reactions WHERE post_id = $1 AND user_id = $2")
        .bind(id).bind(auth.user_id).fetch_optional(&state.db).await?;
    let reactions: Vec<serde_json::Value> = reaction_counts.into_iter()
        .map(|r| serde_json::json!({ "emoji": r.emoji, "count": r.count }))
        .collect();
    Ok(Json(serde_json::json!({ "reactions": reactions, "user_reaction": user_reaction })))
}

// --- Replies ---

async fn get_replies(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(params): Query<CursorQuery>,
) -> Result<Json<PaginatedResponse<PostWithAuthor>>, AppError> {
    let limit = params.limit.unwrap_or(50).min(100);

    let (cursor_ts, cursor_id) = match &params.cursor {
        Some(c) => {
            let (ts, cid) = decode_cursor(c).map_err(|e| AppError::BadRequest(e))?;
            (ts, Some(cid))
        }
        None => (chrono::DateTime::parse_from_rfc3339("2000-01-01T00:00:00Z").unwrap().with_timezone(&chrono::Utc), None),
    };

    let rows = sqlx::query_as::<_, PostWithAuthorRow>(
        r#"
        SELECT p.id, p.author_id, p.content, p.parent_id, p.signature, p.created_at, p.updated_at,
               u.username AS author_username, u.display_name AS author_display_name,
               u.is_bot AS author_is_bot,
               u.signing_key AS author_signing_key,
               u.avatar_url AS author_avatar_url,
               COALESCE((SELECT json_agg(json_build_object('emoji', sub.kind, 'count', sub.cnt))
                 FROM (SELECT kind, COUNT(*) AS cnt FROM reactions WHERE post_id = p.id GROUP BY kind) sub
               ), '[]'::json) AS reaction_counts,
               (SELECT kind FROM reactions WHERE post_id = p.id AND user_id = $1) AS user_reaction,
               0::bigint AS reply_count
        FROM posts p
        JOIN users u ON u.id = p.author_id
        WHERE p.parent_id = $2
          AND (p.created_at, p.id) > ($3, COALESCE($5, '00000000-0000-0000-0000-000000000000'::uuid))
        ORDER BY p.created_at ASC, p.id ASC
        LIMIT $4
        "#,
    )
    .bind(auth.user_id)
    .bind(id)
    .bind(cursor_ts)
    .bind(limit)
    .bind(cursor_id)
    .fetch_all(&state.db)
    .await?;

    let posts: Vec<PostWithAuthor> = rows.into_iter().map(|r| PostWithAuthor {
        post: Post {
            id: r.id,
            author_id: r.author_id,
            content: r.content,
            parent_id: r.parent_id,
            signature: r.signature,
            created_at: r.created_at,
            updated_at: r.updated_at,
        },
        author_username: r.author_username,
        author_display_name: r.author_display_name,
        author_is_bot: r.author_is_bot,
        reaction_counts: r.reaction_counts,
        user_reaction: r.user_reaction,
        reply_count: r.reply_count,
        author_signing_key: r.author_signing_key,
        author_avatar_url: r.author_avatar_url,
    }).collect();

    let next_cursor = posts.last().map(|p| encode_cursor(&p.post.created_at, &p.post.id));

    Ok(Json(PaginatedResponse { data: posts, next_cursor }))
}

// --- Feed ---

async fn get_feed(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(params): Query<CursorQuery>,
) -> Result<Json<PaginatedResponse<PostWithAuthor>>, AppError> {
    let limit = params.limit.unwrap_or(20).min(50);

    let (cursor_ts, cursor_id) = match &params.cursor {
        Some(c) => {
            let (ts, id) = decode_cursor(c).map_err(|e| AppError::BadRequest(e))?;
            (ts, Some(id))
        }
        None => (chrono::Utc::now(), None),
    };

    let rows = sqlx::query_as::<_, PostWithAuthorRow>(
        r#"
        SELECT p.id, p.author_id, p.content, p.parent_id, p.signature, p.created_at, p.updated_at,
               u.username AS author_username, u.display_name AS author_display_name,
               u.is_bot AS author_is_bot,
               u.signing_key AS author_signing_key,
               u.avatar_url AS author_avatar_url,
               COALESCE((SELECT json_agg(json_build_object('emoji', sub.kind, 'count', sub.cnt))
                 FROM (SELECT kind, COUNT(*) AS cnt FROM reactions WHERE post_id = p.id GROUP BY kind) sub
               ), '[]'::json) AS reaction_counts,
               (SELECT kind FROM reactions WHERE post_id = p.id AND user_id = $1) AS user_reaction,
               (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
        FROM posts p
        JOIN users u ON u.id = p.author_id
        WHERE (p.author_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
               OR p.author_id = $1)
          AND p.parent_id IS NULL
          AND (p.created_at, p.id) < ($2, COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid))
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT $3
        "#,
    )
    .bind(auth.user_id)
    .bind(cursor_ts)
    .bind(limit)
    .bind(cursor_id)
    .fetch_all(&state.db)
    .await?;

    let posts: Vec<PostWithAuthor> = rows.into_iter().map(|r| PostWithAuthor {
        post: Post {
            id: r.id,
            author_id: r.author_id,
            content: r.content,
            parent_id: r.parent_id,
            signature: r.signature,
            created_at: r.created_at,
            updated_at: r.updated_at,
        },
        author_username: r.author_username,
        author_display_name: r.author_display_name,
        author_is_bot: r.author_is_bot,
        reaction_counts: r.reaction_counts,
        user_reaction: r.user_reaction,
        reply_count: r.reply_count,
        author_signing_key: r.author_signing_key,
        author_avatar_url: r.author_avatar_url,
    }).collect();

    let next_cursor = posts.last().map(|p| encode_cursor(&p.post.created_at, &p.post.id));

    Ok(Json(PaginatedResponse { data: posts, next_cursor }))
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

    // Validate all participants exist
    let existing_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM users WHERE id = ANY($1)"
    )
    .bind(&body.participant_ids)
    .fetch_one(&state.db)
    .await?;

    if existing_count != body.participant_ids.len() as i64 {
        return Err(AppError::BadRequest("One or more participants do not exist".into()));
    }

    let conv = sqlx::query_as::<_, Conversation>(
        "INSERT INTO conversations (name) VALUES ($1) RETURNING *"
    )
    .bind(&body.name)
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
        SELECT c.id, c.created_at, c.name,
               NULL::text AS last_message_text,
               m.created_at AS last_message_at,
               m.sender_id AS last_message_sender_id
        FROM conversations c
        JOIN conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = $1
        LEFT JOIN LATERAL (
            SELECT created_at, sender_id FROM messages
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

async fn update_conversation(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateConversationRequest>,
) -> Result<Json<Conversation>, AppError> {
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

    if let Some(ref name) = body.name {
        if name.len() > 128 {
            return Err(AppError::BadRequest("Conversation name must be at most 128 characters".into()));
        }
    }

    let conv = sqlx::query_as::<_, Conversation>(
        "UPDATE conversations SET name = $1 WHERE id = $2 RETURNING *"
    )
    .bind(&body.name)
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(conv))
}

async fn get_messages(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Query(params): Query<CursorQuery>,
) -> Result<Json<PaginatedResponse<MessageWithSender>>, AppError> {
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

    let (cursor_ts, cursor_id) = match &params.cursor {
        Some(c) => {
            let (ts, cid) = decode_cursor(c).map_err(|e| AppError::BadRequest(e))?;
            (ts, Some(cid))
        }
        None => (chrono::Utc::now(), None),
    };

    let messages = sqlx::query_as::<_, MessageWithSender>(
        r#"
        SELECT m.id, m.conversation_id, m.sender_id, m.plaintext, m.ciphertext, m.nonce, m.message_type, m.image_url, m.created_at,
               u.username AS sender_username, u.is_bot AS sender_is_bot
        FROM messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
          AND (m.created_at, m.id) < ($2, COALESCE($4, '00000000-0000-0000-0000-000000000000'::uuid))
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $3
        "#,
    )
    .bind(id)
    .bind(cursor_ts)
    .bind(limit)
    .bind(cursor_id)
    .fetch_all(&state.db)
    .await?;

    let next_cursor = messages.last().map(|m| encode_cursor(&m.created_at, &m.id));

    Ok(Json(PaginatedResponse { data: messages, next_cursor }))
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
        .header("X-Content-Type-Options", "nosniff")
        .body(axum::body::Body::from(data))
        .unwrap())
}

// --- WebSocket ---

async fn create_ws_ticket(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<serde_json::Value>, AppError> {
    let ticket = Uuid::new_v4().to_string();
    state.ws_tickets.insert(ticket.clone(), (auth.user_id, auth.username.clone(), Instant::now()));
    Ok(Json(serde_json::json!({ "ticket": ticket })))
}

#[derive(serde::Deserialize)]
struct WsQuery {
    ticket: String,
}

async fn ws_handler(
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> Result<axum::response::Response, AppError> {
    let (user_id, username) = state
        .ws_tickets
        .remove(&query.ticket)
        .and_then(|(_, (uid, uname, created_at))| {
            if created_at.elapsed().as_secs() <= 30 {
                Some((uid, uname))
            } else {
                None
            }
        })
        .ok_or_else(|| AppError::Unauthorized("Invalid or expired ticket".into()))?;

    let is_bot = sqlx::query_scalar::<_, bool>("SELECT is_bot FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(false);

    Ok(ws.max_frame_size(64 * 1024) // 64 KB max frame size
        .on_upgrade(move |socket| handle_ws(socket, state, user_id, username, is_bot)))
}

/// Max message content length for WS chat messages (matches post limit)
const WS_MAX_CONTENT_LEN: usize = 10_000;
/// Max WS messages per second per connection
const WS_RATE_LIMIT: u32 = 10;

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

    // Per-connection rate limiting state
    let mut msg_count: u32 = 0;
    let mut window_start = Instant::now();

    // Receive messages from client
    while let Some(Ok(msg)) = ws_stream.next().await {
        match msg {
            WsMsg::Text(text) => {
                // Rate limit: max WS_RATE_LIMIT messages per second
                if window_start.elapsed().as_secs() >= 1 {
                    msg_count = 0;
                    window_start = Instant::now();
                }
                msg_count += 1;
                if msg_count > WS_RATE_LIMIT {
                    tracing::warn!("WS rate limit exceeded for user {user_id}");
                    continue;
                }

                if let Ok(client_msg) = serde_json::from_str::<WsClientMessage>(&text) {
                    match client_msg {
                        WsClientMessage::SendMessage { conversation_id, content, image_url, ciphertext, nonce, message_type } => {
                            // Validate content/ciphertext size
                            if content.as_ref().map_or(false, |c| c.len() > WS_MAX_CONTENT_LEN)
                                || ciphertext.as_ref().map_or(false, |c| c.len() > WS_MAX_CONTENT_LEN)
                            {
                                tracing::warn!("WS message too large from user {user_id}");
                                continue;
                            }
                            handle_send_message(&state, user_id, &username, is_bot, conversation_id, content, image_url, ciphertext, nonce, message_type).await;
                        }
                        WsClientMessage::Typing { conversation_id } => {
                            handle_typing(&state, user_id, &username, conversation_id).await;
                        }
                        WsClientMessage::VerifyIdentity { target_user_id } => {
                            let msg = WsServerMessage::VerifyIdentity {
                                from_user_id: user_id,
                                from_username: username.clone(),
                            };
                            state.connections.send_to_user(target_user_id, &msg);
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
    content: Option<String>,
    image_url: Option<String>,
    ciphertext: Option<String>,
    nonce: Option<String>,
    message_type: Option<i32>,
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

    // H-1: Never store plaintext — always bind NULL for the plaintext column
    if content.is_some() && ciphertext.is_none() {
        tracing::warn!("Message from {sender_id} has content but no ciphertext — storing with NULL plaintext");
    }
    let message = sqlx::query_as::<_, Message>(
        "INSERT INTO messages (conversation_id, sender_id, plaintext, ciphertext, nonce, message_type, image_url) VALUES ($1, $2, NULL, $3, $4, $5, $6) RETURNING *"
    )
    .bind(conversation_id)
    .bind(sender_id)
    .bind(&ciphertext)
    .bind(&nonce)
    .bind(message_type)
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
    // Verify membership
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2)"
    )
    .bind(conversation_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    if !is_member {
        return;
    }

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

// --- Registration validation helpers (for testing) ---

fn validate_username(username: &str) -> Result<(), String> {
    if username.len() < 3 || username.len() > 32 {
        return Err("Username must be 3-32 characters".into());
    }
    if !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return Err("Username may only contain a-z, A-Z, 0-9, _ and -".into());
    }
    Ok(())
}

fn validate_email(email: &str) -> Result<(), String> {
    let email = email.trim();
    if email.len() > 254 {
        return Err("Email is too long".into());
    }
    let parts: Vec<&str> = email.splitn(2, '@').collect();
    if parts.len() != 2 {
        return Err("Invalid email format".into());
    }
    let (local, domain) = (parts[0], parts[1]);
    if local.is_empty() || local.len() > 64 {
        return Err("Invalid email format".into());
    }
    if domain.len() < 3 || !domain.contains('.') {
        return Err("Invalid email format".into());
    }
    let domain_parts: Vec<&str> = domain.split('.').collect();
    if domain_parts.iter().any(|p| p.is_empty()) {
        return Err("Invalid email format".into());
    }
    if domain_parts.last().map_or(true, |tld| tld.len() < 2) {
        return Err("Invalid email format".into());
    }
    if !local.chars().all(|c| c.is_ascii_alphanumeric() || "._+-".contains(c)) {
        return Err("Invalid email format".into());
    }
    if !domain.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-') {
        return Err("Invalid email format".into());
    }
    Ok(())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters".into());
    }
    if password.len() > 128 {
        return Err("Password must be at most 128 characters".into());
    }
    Ok(())
}

// --- Emoji validation helper (for testing) ---

fn validate_emoji(kind: &str) -> Result<String, String> {
    let trimmed = kind.trim();
    if trimmed.is_empty() {
        return Err("kind must be a single emoji".into());
    }
    if trimmed.chars().count() > 2 {
        return Err("kind must be a single emoji".into());
    }
    if trimmed.chars().any(|c| c.is_ascii_alphanumeric()) {
        return Err("kind must be a single emoji".into());
    }
    Ok(trimmed.to_string())
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
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
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
    signature: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
    author_username: String,
    author_display_name: Option<String>,
    author_is_bot: bool,
    author_signing_key: Option<String>,
    author_avatar_url: Option<String>,
    reaction_counts: serde_json::Value,
    user_reaction: Option<String>,
    reply_count: i64,
}

#[derive(sqlx::FromRow)]
struct ReactionCountRow {
    emoji: String,
    count: i64,
}

// --- Signal Protocol Key Management ---

async fn upload_key_bundle(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UploadKeyBundleRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    // Upsert user's identity key, signed prekey, and optional signing key
    sqlx::query(
        "UPDATE users SET identity_key = $1, signed_prekey = $2, signed_prekey_signature = COALESCE(NULLIF($3, ''), signed_prekey_signature), signed_prekey_id = $4, signing_key = COALESCE(NULLIF($6, ''), signing_key) WHERE id = $5"
    )
    .bind(&body.identity_key)
    .bind(&body.signed_prekey)
    .bind(&body.signed_prekey_signature)
    .bind(body.signed_prekey_id)
    .bind(auth.user_id)
    .bind(&body.signing_key)
    .execute(&state.db)
    .await?;

    // Insert one-time prekeys
    for opk in &body.one_time_prekeys {
        sqlx::query(
            "INSERT INTO prekeys (user_id, key_id, public_key) VALUES ($1, $2, $3) ON CONFLICT (user_id, key_id) DO UPDATE SET public_key = $3"
        )
        .bind(auth.user_id)
        .bind(opk.key_id)
        .bind(&opk.public_key)
        .execute(&state.db)
        .await?;
    }

    Ok(Json(serde_json::json!({ "status": "ok" })))
}

async fn get_key_bundle(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<PreKeyBundleResponse>, AppError> {
    let row = sqlx::query_as::<_, (String, String, String, i32)>(
        "SELECT identity_key, signed_prekey, signed_prekey_signature, signed_prekey_id FROM users WHERE id = $1 AND identity_key IS NOT NULL"
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| AppError::NotFound("No key bundle for user".into()))?;

    // Only pop OPK if requester shares a conversation with the target
    let shares_conversation = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM conversation_members cm1 JOIN conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id WHERE cm1.user_id = $1 AND cm2.user_id = $2)"
    )
    .bind(auth.user_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(false);

    let opk = if shares_conversation {
        sqlx::query_as::<_, (i32, String)>(
            "DELETE FROM prekeys WHERE id = (SELECT id FROM prekeys WHERE user_id = $1 ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING key_id, public_key"
        )
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
    } else {
        None
    };

    Ok(Json(PreKeyBundleResponse {
        user_id,
        identity_key: row.0,
        signed_prekey: row.1,
        signed_prekey_signature: row.2,
        signed_prekey_id: row.3,
        one_time_prekey: opk.map(|(key_id, public_key)| OneTimePreKeyResponse { key_id, public_key }),
    }))
}

async fn get_key_count(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<PreKeyCountResponse>, AppError> {
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM prekeys WHERE user_id = $1")
        .bind(auth.user_id)
        .fetch_one(&state.db)
        .await?;
    Ok(Json(PreKeyCountResponse { count }))
}

async fn get_conversation_members(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<Vec<Uuid>>, AppError> {
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

    let members: Vec<Uuid> = sqlx::query_scalar(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(members))
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- ws_tickets ---

    #[test]
    fn ticket_creation_stores_entry() {
        let tickets: dashmap::DashMap<String, (Uuid, String, std::time::Instant)> = dashmap::DashMap::new();
        let ticket = Uuid::new_v4().to_string();
        let user_id = Uuid::new_v4();
        tickets.insert(ticket.clone(), (user_id, "alice".into(), std::time::Instant::now()));
        assert!(tickets.contains_key(&ticket));
        let entry = tickets.get(&ticket).unwrap();
        assert_eq!(entry.0, user_id);
        assert_eq!(entry.1, "alice");
    }

    #[test]
    fn ticket_consumption_removes_entry() {
        let tickets: dashmap::DashMap<String, (Uuid, String, std::time::Instant)> = dashmap::DashMap::new();
        let ticket = Uuid::new_v4().to_string();
        tickets.insert(ticket.clone(), (Uuid::new_v4(), "bob".into(), std::time::Instant::now()));
        let removed = tickets.remove(&ticket);
        assert!(removed.is_some());
        assert!(!tickets.contains_key(&ticket));
    }

    #[test]
    fn reused_ticket_is_rejected() {
        let tickets: dashmap::DashMap<String, (Uuid, String, std::time::Instant)> = dashmap::DashMap::new();
        let ticket = Uuid::new_v4().to_string();
        tickets.insert(ticket.clone(), (Uuid::new_v4(), "carol".into(), std::time::Instant::now()));
        let _ = tickets.remove(&ticket); // first use
        let second = tickets.remove(&ticket); // reuse
        assert!(second.is_none());
    }

    #[test]
    fn expired_ticket_is_rejected() {
        let tickets: dashmap::DashMap<String, (Uuid, String, std::time::Instant)> = dashmap::DashMap::new();
        let ticket = Uuid::new_v4().to_string();
        let expired = std::time::Instant::now() - std::time::Duration::from_secs(60);
        tickets.insert(ticket.clone(), (Uuid::new_v4(), "dave".into(), expired));
        let result = tickets.remove(&ticket).and_then(|(_, (uid, uname, created_at))| {
            if created_at.elapsed().as_secs() <= 30 { Some((uid, uname)) } else { None }
        });
        assert!(result.is_none());
    }

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

    // --- validate_emoji ---

    #[test]
    fn emoji_accepts_fire() {
        assert_eq!(validate_emoji("🔥").unwrap(), "🔥");
    }

    #[test]
    fn emoji_accepts_brain() {
        assert_eq!(validate_emoji("🧠").unwrap(), "🧠");
    }

    #[test]
    fn emoji_accepts_wave() {
        assert_eq!(validate_emoji("🌊").unwrap(), "🌊");
    }

    #[test]
    fn emoji_accepts_skull() {
        assert_eq!(validate_emoji("💀").unwrap(), "💀");
    }

    #[test]
    fn emoji_accepts_with_whitespace() {
        assert_eq!(validate_emoji(" 🔥 ").unwrap(), "🔥");
    }

    #[test]
    fn emoji_accepts_flag_sequence() {
        // Flag emoji are 2 chars (regional indicators)
        assert!(validate_emoji("🇺🇸").is_ok());
    }

    #[test]
    fn emoji_rejects_empty() {
        assert!(validate_emoji("").is_err());
    }

    #[test]
    fn emoji_rejects_whitespace_only() {
        assert!(validate_emoji("   ").is_err());
    }

    #[test]
    fn emoji_rejects_plain_text() {
        assert!(validate_emoji("like").is_err());
    }

    #[test]
    fn emoji_rejects_alphanumeric() {
        assert!(validate_emoji("a").is_err());
    }

    #[test]
    fn emoji_rejects_number() {
        assert!(validate_emoji("1").is_err());
    }

    #[test]
    fn emoji_rejects_mixed_emoji_and_text() {
        assert!(validate_emoji("🔥a").is_err());
    }

    #[test]
    fn emoji_rejects_too_many_chars() {
        assert!(validate_emoji("🔥🧠💀").is_err());
    }

    // --- validate_username ---

    #[test]
    fn username_accepts_alphanumeric() {
        assert!(validate_username("alice123").is_ok());
    }

    #[test]
    fn username_accepts_underscore_and_dash() {
        assert!(validate_username("cool_user-name").is_ok());
    }

    #[test]
    fn username_rejects_too_short() {
        assert!(validate_username("ab").is_err());
    }

    #[test]
    fn username_rejects_too_long() {
        let long = "a".repeat(33);
        assert!(validate_username(&long).is_err());
    }

    #[test]
    fn username_rejects_spaces() {
        assert!(validate_username("has space").is_err());
    }

    #[test]
    fn username_rejects_special_chars() {
        assert!(validate_username("user@name").is_err());
        assert!(validate_username("user!").is_err());
        assert!(validate_username("user.name").is_err());
    }

    #[test]
    fn username_rejects_unicode() {
        assert!(validate_username("al\u{0456}ce").is_err()); // Cyrillic і
    }

    #[test]
    fn username_accepts_boundary_lengths() {
        assert!(validate_username("abc").is_ok()); // min 3
        assert!(validate_username(&"a".repeat(32)).is_ok()); // max 32
    }

    // --- validate_email ---

    #[test]
    fn email_accepts_valid() {
        assert!(validate_email("user@example.com").is_ok());
        assert!(validate_email("a+b@sub.domain.org").is_ok());
        assert!(validate_email("test.user@mail.co").is_ok());
    }

    #[test]
    fn email_rejects_missing_at() {
        assert!(validate_email("userexample.com").is_err());
    }

    #[test]
    fn email_rejects_missing_dot_in_domain() {
        assert!(validate_email("user@localhost").is_err());
    }

    #[test]
    fn email_rejects_empty_local() {
        assert!(validate_email("@example.com").is_err());
    }

    #[test]
    fn email_rejects_empty_tld() {
        assert!(validate_email("user@example.").is_err());
    }

    #[test]
    fn email_rejects_short_tld() {
        assert!(validate_email("user@example.a").is_err());
    }

    #[test]
    fn email_rejects_bare_at_dot() {
        assert!(validate_email("@.").is_err());
    }

    // --- validate_password ---

    #[test]
    fn password_accepts_valid() {
        assert!(validate_password("securepass123").is_ok());
    }

    #[test]
    fn password_rejects_too_short() {
        assert!(validate_password("short").is_err());
    }

    #[test]
    fn password_rejects_too_long() {
        let long = "a".repeat(129);
        assert!(validate_password(&long).is_err());
    }

    #[test]
    fn password_accepts_boundary_lengths() {
        assert!(validate_password(&"a".repeat(8)).is_ok());   // min 8
        assert!(validate_password(&"a".repeat(128)).is_ok()); // max 128
    }

    // --- like/yikes emoji validation ---

    #[test]
    fn emoji_accepts_thumbs_up_like() {
        assert_eq!(validate_emoji("👍").unwrap(), "👍");
    }

    #[test]
    fn emoji_accepts_grimace_yikes() {
        assert_eq!(validate_emoji("😬").unwrap(), "😬");
    }

    #[test]
    fn emoji_accepts_thumbs_down() {
        assert_eq!(validate_emoji("👎").unwrap(), "👎");
    }

    #[test]
    fn emoji_accepts_heart() {
        assert_eq!(validate_emoji("❤️").unwrap(), "❤️");
    }

    #[test]
    fn emoji_accepts_sparkles() {
        assert_eq!(validate_emoji("✨").unwrap(), "✨");
    }
}

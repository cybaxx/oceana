use axum::extract::{Path, Query, State};
use axum::routing::{get, post, put, delete};
use axum::{Json, Router};
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
        .route("/users/{id}", get(get_user))
        .route("/users/me/profile", put(update_profile))
        // Follow
        .route("/users/{id}/follow", post(follow_user))
        .route("/users/{id}/follow", delete(unfollow_user))
        // Posts
        .route("/posts", post(create_post))
        .route("/posts/{id}", get(get_post))
        .route("/posts/{id}", delete(delete_post))
        // Feed
        .route("/feed", get(get_feed))
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
               u.username AS author_username, u.display_name AS author_display_name
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
    }).collect();

    Ok(Json(posts))
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
}

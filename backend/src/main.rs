mod auth;
mod chat;
mod error;
mod models;
mod rate_limit;
mod routes;

use axum::extract::ConnectInfo;
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::Router;
use chat::ConnectionManager;
use rate_limit::RateLimiter;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use http::Method;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use dashmap::DashMap;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub jwt_secret: String,
    pub connections: ConnectionManager,
    pub rate_limiter: RateLimiter,
    pub ws_tickets: Arc<DashMap<String, (uuid::Uuid, String, Instant)>>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter("oceana_backend=debug,tower_http=debug")
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret = std::env::var("JWT_SECRET").expect("JWT_SECRET must be set");

    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
        .expect("Failed to connect to database");

    // Run migrations (execute each statement individually since sqlx doesn't support multi-statement)
    let mut migrations: Vec<&str> = vec![
        include_str!("../migrations/001_initial.sql"),
        include_str!("../migrations/002_chat.sql"),
        include_str!("../migrations/003_attachments.sql"),
        include_str!("../migrations/004_bot_flag.sql"),
        include_str!("../migrations/005_reactions.sql"),
        include_str!("../migrations/006_emoji_reactions.sql"),
        include_str!("../migrations/007_signal_keys.sql"),
        include_str!("../migrations/008_signing_key.sql"),
    ];

    if std::env::var("SEED_DATA").as_deref() == Ok("true") {
        migrations.push(include_str!("../migrations/999_seed.sql"));
    }

    for migration_sql in migrations {
        for statement in migration_sql.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                if let Err(e) = sqlx::query(stmt).execute(&db).await {
                    tracing::warn!("Migration statement failed: {e}");
                }
            }
        }
    }

    let state = AppState {
        db,
        jwt_secret,
        connections: ConnectionManager::new(),
        rate_limiter: RateLimiter::new(),
        ws_tickets: Arc::new(DashMap::new()),
    };

    // Ensure uploads directory exists
    tokio::fs::create_dir_all("/uploads").await.expect("Failed to create /uploads directory");

    let app = Router::new()
        .nest("/api/v1", routes::router())
        .layer({
            let cors = CorsLayer::new()
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
                .allow_headers([
                    http::header::CONTENT_TYPE,
                    http::header::AUTHORIZATION,
                ]);
            match std::env::var("CORS_ORIGIN") {
                Ok(origin) => cors.allow_origin(origin.parse::<http::HeaderValue>().expect("Invalid CORS_ORIGIN")),
                Err(_) => cors.allow_origin(Any),
            }
        })
        .layer(TraceLayer::new_for_http())
        .layer(middleware::from_fn(security_headers))
        .layer(middleware::from_fn_with_state(state.clone(), rate_limit_middleware))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tracing::info!("listening on http://localhost:3000");
    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>()).await.unwrap();
}

async fn security_headers(req: axum::extract::Request, next: Next) -> Response {
    let mut response = next.run(req).await;
    let headers = response.headers_mut();
    headers.insert(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self' wss:; frame-ancestors 'none'"
            .parse().unwrap(),
    );
    headers.insert("X-Content-Type-Options", "nosniff".parse().unwrap());
    headers.insert("X-Frame-Options", "DENY".parse().unwrap());
    headers.insert("Referrer-Policy", "strict-origin-when-cross-origin".parse().unwrap());
    response
}

async fn rate_limit_middleware(
    axum::extract::State(state): axum::extract::State<AppState>,
    connect_info: ConnectInfo<SocketAddr>,
    req: axum::extract::Request,
    next: Next,
) -> Response {
    let ip = connect_info.0.ip();
    let path = req.uri().path().to_string();

    let (max_requests, window_secs) = if path.starts_with("/api/v1/auth/") {
        (5u32, 60u64)
    } else if path == "/api/v1/upload" {
        (10, 60)
    } else {
        (60, 60)
    };

    if !state.rate_limiter.check(ip, max_requests, window_secs) {
        return (
            http::StatusCode::TOO_MANY_REQUESTS,
            axum::Json(serde_json::json!({ "error": "Too many requests" })),
        ).into_response();
    }

    next.run(req).await
}

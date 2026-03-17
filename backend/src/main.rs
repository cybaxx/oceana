mod auth;
mod chat;
mod error;
mod models;
mod routes;

use axum::Router;
use chat::ConnectionManager;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub jwt_secret: String,
    pub connections: ConnectionManager,
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
    for migration_sql in [
        include_str!("../migrations/001_initial.sql"),
        include_str!("../migrations/002_chat.sql"),
        include_str!("../migrations/003_attachments.sql"),
        include_str!("../migrations/004_bot_flag.sql"),
        include_str!("../migrations/999_seed.sql"),
    ] {
        for statement in migration_sql.split(';') {
            let stmt = statement.trim();
            if !stmt.is_empty() {
                sqlx::query(stmt).execute(&db).await.ok();
            }
        }
    }

    let state = AppState {
        db,
        jwt_secret,
        connections: ConnectionManager::new(),
    };

    // Ensure uploads directory exists
    tokio::fs::create_dir_all("/uploads").await.expect("Failed to create /uploads directory");

    let app = Router::new()
        .nest("/api/v1", routes::router())
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    tracing::info!("listening on http://localhost:3000");
    axum::serve(listener, app).await.unwrap();
}

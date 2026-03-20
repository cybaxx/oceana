use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    BadRequest(String),
    Unauthorized(String),
    NotFound(String),
    Conflict(String),
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            AppError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg),
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {msg}");
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".into())
            }
        };
        (status, Json(json!({ "error": { "message": message } }))).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        AppError::Internal(e.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(e: jsonwebtoken::errors::Error) -> Self {
        tracing::debug!("JWT error: {e}");
        AppError::Unauthorized("Invalid token".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::to_bytes;

    async fn response_status_and_body(err: AppError) -> (StatusCode, serde_json::Value) {
        let response = err.into_response();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        (status, body)
    }

    #[tokio::test]
    async fn bad_request_returns_400() {
        let (status, body) = response_status_and_body(AppError::BadRequest("bad input".into())).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body["error"]["message"], "bad input");
    }

    #[tokio::test]
    async fn unauthorized_returns_401() {
        let (status, body) = response_status_and_body(AppError::Unauthorized("no token".into())).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(body["error"]["message"], "no token");
    }

    #[tokio::test]
    async fn not_found_returns_404() {
        let (status, body) = response_status_and_body(AppError::NotFound("gone".into())).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body["error"]["message"], "gone");
    }

    #[tokio::test]
    async fn conflict_returns_409() {
        let (status, body) = response_status_and_body(AppError::Conflict("duplicate".into())).await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body["error"]["message"], "duplicate");
    }

    #[tokio::test]
    async fn internal_hides_real_message() {
        let (status, body) = response_status_and_body(AppError::Internal("db crash details".into())).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body["error"]["message"], "Internal server error");
    }

    #[test]
    fn jwt_error_converts_to_unauthorized() {
        let jwt_err = jsonwebtoken::decode::<serde_json::Value>(
            "bad",
            &jsonwebtoken::DecodingKey::from_secret(b"x"),
            &jsonwebtoken::Validation::default(),
        ).unwrap_err();
        let app_err: AppError = jwt_err.into();
        assert!(matches!(app_err, AppError::Unauthorized(_)));
    }
}

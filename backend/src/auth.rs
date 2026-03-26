use async_trait::async_trait;
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,       // user id
    pub username: String,
    pub exp: usize,      // expiry (unix timestamp)
    pub iat: usize,      // issued at
}

pub fn create_token(user_id: Uuid, username: &str, secret: &str) -> Result<String, AppError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id,
        username: username.to_string(),
        exp: now + 900, // 15 min; use refresh tokens for longer sessions
        iat: now,
    };
    Ok(encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?)
}

pub fn verify_token(token: &str, secret: &str) -> Result<Claims, AppError> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

/// Extractor: pulls authenticated user from Authorization header
pub struct AuthUser {
    pub user_id: Uuid,
    pub username: String,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or_else(|| AppError::Unauthorized("Invalid authorization format".into()))?;

        let claims = verify_token(token, &state.jwt_secret)?;
        Ok(AuthUser {
            user_id: claims.sub,
            username: claims.username,
        })
    }
}

pub async fn create_refresh_token(db: &sqlx::PgPool, user_id: Uuid) -> Result<String, AppError> {
    let token = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + chrono::Duration::days(30);
    sqlx::query("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)")
        .bind(user_id)
        .bind(&token)
        .bind(expires_at)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(token)
}

pub async fn validate_refresh_token(
    db: &sqlx::PgPool,
    token: &str,
) -> Result<Option<(Uuid, String)>, AppError> {
    let row = sqlx::query_as::<_, (Uuid, String)>(
        "SELECT rt.user_id, u.username FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token = $1 AND rt.expires_at > NOW()"
    )
    .bind(token)
    .fetch_optional(db)
    .await
    .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(row)
}

pub async fn revoke_refresh_token(db: &sqlx::PgPool, token: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM refresh_tokens WHERE token = $1")
        .bind(token)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

pub async fn revoke_user_refresh_tokens(db: &sqlx::PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query("DELETE FROM refresh_tokens WHERE user_id = $1")
        .bind(user_id)
        .execute(db)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

pub fn hash_password(password: &str) -> Result<String, AppError> {
    use argon2::{password_hash::SaltString, Algorithm, Argon2, Params, PasswordHasher, Version};
    let salt = SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);

    let m_cost: u32 = std::env::var("ARGON2_M_COST")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(47104);
    let t_cost: u32 = std::env::var("ARGON2_T_COST")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);
    let p_cost: u32 = std::env::var("ARGON2_P_COST")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1);

    let params = Params::new(m_cost, t_cost, p_cost, None)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(e.to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> Result<bool, AppError> {
    use argon2::{password_hash::PasswordHash, Argon2, PasswordVerifier};
    let parsed = PasswordHash::new(hash).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &str = "test-secret-key";

    #[test]
    fn create_and_verify_token() {
        let user_id = Uuid::new_v4();
        let token = create_token(user_id, "testuser", SECRET).unwrap();
        let claims = verify_token(&token, SECRET).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.username, "testuser");
    }

    #[test]
    fn verify_token_wrong_secret_fails() {
        let token = create_token(Uuid::new_v4(), "user", SECRET).unwrap();
        assert!(verify_token(&token, "wrong-secret").is_err());
    }

    #[test]
    fn verify_token_garbage_fails() {
        assert!(verify_token("not.a.jwt", SECRET).is_err());
    }

    #[test]
    fn token_contains_expiry() {
        let token = create_token(Uuid::new_v4(), "user", SECRET).unwrap();
        let claims = verify_token(&token, SECRET).unwrap();
        assert!(claims.exp > claims.iat);
        assert_eq!(claims.exp - claims.iat, 900);
    }

    #[test]
    fn hash_and_verify_password() {
        let hash = hash_password("mypassword123").unwrap();
        assert!(verify_password("mypassword123", &hash).unwrap());
    }

    #[test]
    fn wrong_password_fails_verification() {
        let hash = hash_password("correct-password").unwrap();
        assert!(!verify_password("wrong-password", &hash).unwrap());
    }

    #[test]
    fn same_password_produces_different_hashes() {
        let h1 = hash_password("same-password").unwrap();
        let h2 = hash_password("same-password").unwrap();
        assert_ne!(h1, h2); // different salts
        // but both verify
        assert!(verify_password("same-password", &h1).unwrap());
        assert!(verify_password("same-password", &h2).unwrap());
    }

    #[test]
    fn invalid_hash_string_returns_error() {
        assert!(verify_password("anything", "not-a-valid-hash").is_err());
    }
}

use sqlx::{AnyPool, Row};
use crate::models::User;

pub struct StoredUser {
    pub id: String,
    pub username: String,
    pub password_hash: String,
}

pub async fn insert_user(
    pool: &AnyPool,
    id: &str,
    username: &str,
    password_hash: &str,
) -> Result<User, sqlx::Error> {
    let normalized = username.trim().to_lowercase();
    sqlx::query(
        "INSERT INTO users (id, username, normalized_username, password_hash) VALUES ($1, $2, $3, $4)",
    )
    .bind(id)
    .bind(username)
    .bind(&normalized)
    .bind(password_hash)
    .execute(pool)
    .await?;

    Ok(User { id: id.to_string(), username: username.to_string() })
}

pub async fn find_by_username(
    pool: &AnyPool,
    username: &str,
) -> Result<Option<StoredUser>, sqlx::Error> {
    let key = username.trim().to_lowercase();
    let row = sqlx::query(
        "SELECT id, username, password_hash FROM users WHERE normalized_username = $1",
    )
    .bind(&key)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| StoredUser {
        id: r.get("id"),
        username: r.get("username"),
        password_hash: r.get("password_hash"),
    }))
}

pub async fn user_exists(pool: &AnyPool) -> Result<bool, sqlx::Error> {
    let row = sqlx::query("SELECT id FROM users LIMIT 1")
        .fetch_optional(pool)
        .await?;
    Ok(row.is_some())
}

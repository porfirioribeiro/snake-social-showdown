use sqlx::{AnyPool, Row};
use crate::models::User;

pub async fn create_session(pool: &AnyPool, token: &str, user_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO sessions (token, user_id) VALUES ($1, $2)")
        .bind(token)
        .bind(user_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn delete_session(pool: &AnyPool, token: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM sessions WHERE token = $1")
        .bind(token)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn user_for_token(pool: &AnyPool, token: &str) -> Result<Option<User>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT u.id, u.username FROM users u
         JOIN sessions s ON s.user_id = u.id
         WHERE s.token = $1",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row.map(|r| User {
        id: r.get("id"),
        username: r.get("username"),
    }))
}

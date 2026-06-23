use sqlx::{AnyPool, Row};
use crate::models::{GameMode, ScoreEntry};

pub async fn insert_score(pool: &AnyPool, entry: &ScoreEntry) -> Result<(), sqlx::Error> {
    let mode = entry.mode.as_str();
    sqlx::query(
        "INSERT INTO scores (id, user_id, username, mode, score, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(&entry.id)
    .bind(&entry.user_id)
    .bind(&entry.username)
    .bind(mode)
    .bind(entry.score)
    .bind(entry.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn leaderboard(
    pool: &AnyPool,
    mode: &GameMode,
    limit: i64,
) -> Result<Vec<ScoreEntry>, sqlx::Error> {
    let mode_str = mode.as_str();
    let rows = sqlx::query(
        "SELECT id, user_id, username, mode, score, created_at FROM scores
         WHERE mode = $1
         ORDER BY score DESC, created_at ASC
         LIMIT $2",
    )
    .bind(mode_str)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let entries = rows
        .into_iter()
        .filter_map(|r| {
            let mode = GameMode::from_str(r.get("mode"))?;
            Some(ScoreEntry {
                id: r.get("id"),
                user_id: r.get("user_id"),
                username: r.get("username"),
                mode,
                score: r.get("score"),
                created_at: r.get("created_at"),
            })
        })
        .collect();

    Ok(entries)
}

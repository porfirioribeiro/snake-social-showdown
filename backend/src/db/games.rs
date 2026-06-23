use sqlx::{AnyPool, Row};
use crate::models::{ActiveGameSummary, Cell, GameMode, GameState};

pub async fn create_game(pool: &AnyPool, game: &GameState) -> Result<(), sqlx::Error> {
    let mut tx = pool.begin().await?;

    sqlx::query("DELETE FROM games WHERE user_id = $1")
        .bind(&game.user_id)
        .execute(&mut *tx)
        .await?;

    let mode = game.mode.as_str();
    let snake = serde_json::to_string(&game.snake).unwrap();
    let food = serde_json::to_string(&game.food).unwrap();
    let dir = serde_json::to_string(&game.dir).unwrap();
    let alive = game.alive as i32;

    sqlx::query(
        "INSERT INTO games (id, user_id, username, mode, width, height, snake, food, dir, score, alive, started_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
    )
    .bind(&game.id)
    .bind(&game.user_id)
    .bind(&game.username)
    .bind(mode)
    .bind(game.width)
    .bind(game.height)
    .bind(&snake)
    .bind(&food)
    .bind(&dir)
    .bind(game.score)
    .bind(alive)
    .bind(game.started_at)
    .bind(game.updated_at)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn get_game(pool: &AnyPool, game_id: &str) -> Result<Option<GameState>, sqlx::Error> {
    let row = sqlx::query(
        "SELECT id, user_id, username, mode, width, height, snake, food, dir, score, alive, started_at, updated_at
         FROM games WHERE id = $1",
    )
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    Ok(row.and_then(|r| {
        row_to_game_state(
            r.get("id"), r.get("user_id"), r.get("username"), r.get("mode"),
            r.get("width"), r.get("height"), r.get("snake"), r.get("food"), r.get("dir"),
            r.get("score"), r.get::<i32, _>("alive"), r.get("started_at"), r.get("updated_at"),
        )
    }))
}

pub async fn delete_game(pool: &AnyPool, game_id: &str, user_id: Option<&str>) -> Result<bool, sqlx::Error> {
    let rows_affected = if let Some(uid) = user_id {
        sqlx::query("DELETE FROM games WHERE id = $1 AND user_id = $2")
            .bind(game_id)
            .bind(uid)
            .execute(pool)
            .await?
            .rows_affected()
    } else {
        sqlx::query("DELETE FROM games WHERE id = $1")
            .bind(game_id)
            .execute(pool)
            .await?
            .rows_affected()
    };
    Ok(rows_affected > 0)
}

pub async fn update_game(
    pool: &AnyPool,
    game_id: &str,
    state: &GameState,
    updated_at: i64,
) -> Result<Option<GameState>, sqlx::Error> {
    if !state.alive {
        sqlx::query("DELETE FROM games WHERE id = $1")
            .bind(game_id)
            .execute(pool)
            .await?;
        return Ok(None);
    }

    let mode = state.mode.as_str();
    let snake = serde_json::to_string(&state.snake).unwrap();
    let food = serde_json::to_string(&state.food).unwrap();
    let dir = serde_json::to_string(&state.dir).unwrap();
    let alive = state.alive as i32;

    let rows = sqlx::query(
        "UPDATE games SET username=$1, mode=$2, width=$3, height=$4, snake=$5, food=$6, dir=$7,
         score=$8, alive=$9, started_at=$10, updated_at=$11
         WHERE id=$12",
    )
    .bind(&state.username)
    .bind(mode)
    .bind(state.width)
    .bind(state.height)
    .bind(&snake)
    .bind(&food)
    .bind(&dir)
    .bind(state.score)
    .bind(alive)
    .bind(state.started_at)
    .bind(updated_at)
    .bind(game_id)
    .execute(pool)
    .await?
    .rows_affected();

    if rows == 0 {
        return Ok(None);
    }

    let mut updated = state.clone();
    updated.updated_at = updated_at;
    Ok(Some(updated))
}

pub async fn active_games(pool: &AnyPool) -> Result<Vec<ActiveGameSummary>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, username, mode, score FROM games WHERE alive = 1 ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let summaries = rows
        .into_iter()
        .filter_map(|r| {
            let mode = GameMode::from_str(r.get("mode"))?;
            Some(ActiveGameSummary {
                id: r.get("id"),
                username: r.get("username"),
                mode,
                score: r.get("score"),
            })
        })
        .collect();

    Ok(summaries)
}

pub async fn active_game_ids_for_user(pool: &AnyPool, user_id: &str) -> Result<Vec<String>, sqlx::Error> {
    let rows = sqlx::query("SELECT id FROM games WHERE user_id = $1 AND alive = 1")
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.into_iter().map(|r| r.get("id")).collect())
}

fn row_to_game_state(
    id: String, user_id: String, username: String, mode: String,
    width: i64, height: i64, snake: String, food: String, dir: String,
    score: i64, alive: i32, started_at: i64, updated_at: i64,
) -> Option<GameState> {
    let mode = GameMode::from_str(&mode)?;
    let snake: Vec<Cell> = serde_json::from_str(&snake).ok()?;
    let food: Cell = serde_json::from_str(&food).ok()?;
    let dir: Cell = serde_json::from_str(&dir).ok()?;

    Some(GameState {
        id,
        user_id,
        username,
        mode,
        width,
        height,
        snake,
        food,
        dir,
        score,
        alive: alive != 0,
        started_at,
        updated_at,
    })
}

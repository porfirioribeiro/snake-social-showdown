use axum::{
    Json,
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::Deserialize;

use crate::{
    auth::RequiredUser,
    db,
    error::AppResult,
    models::{GameMode, ScoreEntry, SubmitScoreRequest},
    state::AppState,
    util::{new_id, now_ms},
};

#[derive(Deserialize)]
pub struct LeaderboardQuery {
    pub mode: GameMode,
    #[serde(default = "default_limit")]
    pub limit: i64,
}

fn default_limit() -> i64 {
    10
}

pub async fn submit_score(
    State(state): State<AppState>,
    RequiredUser(user): RequiredUser,
    Json(payload): Json<SubmitScoreRequest>,
) -> AppResult<impl IntoResponse> {
    if payload.score < 0 {
        return Err(crate::error::AppError::BadRequest("Score must be >= 0".into()));
    }

    let entry = ScoreEntry {
        id: new_id("score"),
        user_id: user.id,
        username: user.username,
        mode: payload.mode,
        score: payload.score,
        created_at: now_ms(),
    };
    db::scores::insert_score(&state.pool, &entry).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn leaderboard(
    State(state): State<AppState>,
    Query(q): Query<LeaderboardQuery>,
) -> AppResult<Json<Vec<ScoreEntry>>> {
    let limit = q.limit.max(1);
    let entries = db::scores::leaderboard(&state.pool, &q.mode, limit).await?;
    Ok(Json(entries))
}

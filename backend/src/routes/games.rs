use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};

use crate::{
    auth::RequiredUser,
    db,
    error::AppResult,
    models::{ActiveGameSummary, Cell, CreateGameRequest, GameMode, GameState},
    state::AppState,
    util::{new_id, now_ms},
};

fn make_game(user_id: &str, username: &str, mode: GameMode) -> GameState {
    let ts = now_ms();
    GameState {
        id: new_id("game"),
        user_id: user_id.to_string(),
        username: username.to_string(),
        mode,
        width: 20,
        height: 20,
        snake: vec![
            Cell { x: 10, y: 10 },
            Cell { x: 9, y: 10 },
            Cell { x: 8, y: 10 },
        ],
        food: Cell { x: 4, y: 7 },
        dir: Cell { x: 1, y: 0 },
        score: 0,
        alive: true,
        started_at: ts - 60_000,
        updated_at: ts,
    }
}

pub async fn create_game(
    State(state): State<AppState>,
    RequiredUser(user): RequiredUser,
    Json(payload): Json<CreateGameRequest>,
) -> AppResult<impl IntoResponse> {
    let replaced_ids = db::games::active_game_ids_for_user(&state.pool, &user.id).await?;
    let game = make_game(&user.id, &user.username, payload.mode);
    db::games::create_game(&state.pool, &game).await?;

    for game_id in &replaced_ids {
        state.hub.broadcast_game_deleted(game_id).await;
    }
    let active = db::games::active_games(&state.pool).await?;
    state.hub.broadcast_active_games(&active).await;

    Ok((StatusCode::OK, Json(game)))
}

pub async fn list_active_games(
    State(state): State<AppState>,
) -> AppResult<Json<Vec<ActiveGameSummary>>> {
    let games = db::games::active_games(&state.pool).await?;
    Ok(Json(games))
}

pub async fn get_game(
    State(state): State<AppState>,
    Path(game_id): Path<String>,
) -> AppResult<Json<Option<GameState>>> {
    let game = db::games::get_game(&state.pool, &game_id).await?;
    Ok(Json(game))
}

pub async fn abandon_game(
    State(state): State<AppState>,
    RequiredUser(user): RequiredUser,
    Path(game_id): Path<String>,
) -> AppResult<impl IntoResponse> {
    let deleted = db::games::delete_game(&state.pool, &game_id, Some(&user.id)).await?;
    if deleted {
        state.hub.broadcast_game_deleted(&game_id).await;
        let active = db::games::active_games(&state.pool).await?;
        state.hub.broadcast_active_games(&active).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

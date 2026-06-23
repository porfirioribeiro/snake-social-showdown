pub mod auth;
pub mod games;
pub mod scores;
pub mod ws;

use axum::{Router, routing::{get, post}};
use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/signup", post(auth::signup))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/games", post(games::create_game))
        .route("/api/games/active", get(games::list_active_games))
        .route("/api/games/ws", get(ws::games_ws_authed))
        .route("/api/games/{game_id}", get(games::get_game))
        .route("/api/games/{game_id}/abandon", post(games::abandon_game))
        .route("/api/scores", post(scores::submit_score))
        .route("/api/leaderboard", get(scores::leaderboard))
        .with_state(state)
}

async fn health() -> axum::Json<serde_json::Value> {
    axum::Json(serde_json::json!({ "status": "ok" }))
}

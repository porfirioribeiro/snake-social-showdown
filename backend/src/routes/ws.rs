use axum::{
    extract::{
        State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use tokio::sync::mpsc;

use crate::{
    db,
    models::GameState,
    state::AppState,
};


/// WebSocket handler that authenticates via ?token= query param or session cookie
pub async fn games_ws_authed(
    ws: WebSocketUpgrade,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
    headers: axum::http::HeaderMap,
    State(state): State<AppState>,
) -> impl IntoResponse {
    // Resolve user for ownership checks during game-update messages
    let token = params.get("token").cloned().or_else(|| {
        headers.get("cookie").and_then(|v| v.to_str().ok()).and_then(|cookies| {
            cookies.split(';').find_map(|part| {
                let part = part.trim();
                part.strip_prefix("session=").map(|v| v.to_owned())
            })
        })
    });

    ws.on_upgrade(move |socket| handle_socket_authed(socket, state, token))
}

async fn handle_socket_authed(socket: WebSocket, state: AppState, token: Option<String>) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let conn_id = state.hub.next_conn_id();

    // Resolve the user once at connection time
    let current_user = match &token {
        Some(t) => db::sessions::user_for_token(&state.pool, t).await.unwrap_or(None),
        None => None,
    };

    let send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };

        let parsed: serde_json::Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(_) => break,
        };

        let msg_type = parsed.get("type").and_then(|v| v.as_str());

        match msg_type {
            Some("subscribe-active") => {
                state.hub.subscribe_active(conn_id, tx.clone()).await;
                let games = db::games::active_games(&state.pool).await.unwrap_or_default();
                let payload = serde_json::json!({ "type": "active-games", "games": games });
                let _ = tx.send(Message::Text(payload.to_string().into()));
            }

            Some("subscribe-game") => {
                let game_id = match parsed.get("gameId").and_then(|v| v.as_str()) {
                    Some(id) => id.to_owned(),
                    None => break,
                };
                state.hub.subscribe_game(&game_id, conn_id, tx.clone()).await;

                let response = match db::games::get_game(&state.pool, &game_id).await.unwrap_or(None) {
                    Some(game) => serde_json::json!({ "type": "game-state", "game": game }),
                    None => serde_json::json!({ "type": "game-deleted", "gameId": game_id }),
                };
                let _ = tx.send(Message::Text(response.to_string().into()));
            }

            Some("game-update") => {
                let game: GameState = match parsed.get("game")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                {
                    Some(g) => g,
                    None => break,
                };

                let user = match &current_user {
                    Some(u) => u,
                    None => break, // unauthenticated
                };

                let existing = match db::games::get_game(&state.pool, &game.id).await.unwrap_or(None) {
                    Some(g) => g,
                    None => break,
                };

                // Verify ownership
                if existing.user_id != user.id || game.user_id != user.id {
                    break;
                }

                let updated_at = crate::util::now_ms();
                let result = db::games::update_game(&state.pool, &game.id, &game, updated_at)
                    .await
                    .unwrap_or(None);

                match result {
                    None => state.hub.broadcast_game_deleted(&game.id).await,
                    Some(ref updated) => state.hub.broadcast_game_state(updated).await,
                }

                let active = db::games::active_games(&state.pool).await.unwrap_or_default();
                state.hub.broadcast_active_games(&active).await;
            }

            _ => {}
        }
    }

    state.hub.disconnect(conn_id).await;
    send_task.abort();
}

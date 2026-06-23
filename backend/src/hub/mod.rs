use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use axum::extract::ws::Message;
use tokio::sync::{mpsc::UnboundedSender, RwLock};

use crate::models::{ActiveGameSummary, GameState};

type ConnId = u64;

struct HubInner {
    active_subscribers: HashMap<ConnId, UnboundedSender<Message>>,
    game_subscribers: HashMap<String, HashMap<ConnId, UnboundedSender<Message>>>,
}

pub struct LiveHub {
    inner: RwLock<HubInner>,
    next_id: AtomicU64,
}

impl LiveHub {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(HubInner {
                active_subscribers: HashMap::new(),
                game_subscribers: HashMap::new(),
            }),
            next_id: AtomicU64::new(0),
        }
    }

    pub fn next_conn_id(&self) -> ConnId {
        self.next_id.fetch_add(1, Ordering::Relaxed)
    }

    pub async fn subscribe_active(&self, conn_id: ConnId, tx: UnboundedSender<Message>) {
        self.inner.write().await.active_subscribers.insert(conn_id, tx);
    }

    pub async fn unsubscribe_active(&self, conn_id: ConnId) {
        self.inner.write().await.active_subscribers.remove(&conn_id);
    }

    pub async fn subscribe_game(&self, game_id: &str, conn_id: ConnId, tx: UnboundedSender<Message>) {
        self.inner
            .write()
            .await
            .game_subscribers
            .entry(game_id.to_string())
            .or_default()
            .insert(conn_id, tx);
    }

    pub async fn unsubscribe_game(&self, game_id: &str, conn_id: ConnId) {
        let mut inner = self.inner.write().await;
        if let Some(subs) = inner.game_subscribers.get_mut(game_id) {
            subs.remove(&conn_id);
            if subs.is_empty() {
                inner.game_subscribers.remove(game_id);
            }
        }
    }

    pub async fn disconnect(&self, conn_id: ConnId) {
        let mut inner = self.inner.write().await;
        inner.active_subscribers.remove(&conn_id);
        inner.game_subscribers.retain(|_, subs| {
            subs.remove(&conn_id);
            !subs.is_empty()
        });
    }

    pub async fn broadcast_game_state(&self, game: &GameState) {
        let payload = serde_json::json!({
            "type": "game-state",
            "game": game,
        });
        self.broadcast_to_game(&game.id, payload).await;
    }

    pub async fn broadcast_game_deleted(&self, game_id: &str) {
        let payload = serde_json::json!({
            "type": "game-deleted",
            "gameId": game_id,
        });
        self.broadcast_to_game(game_id, payload).await;
    }

    pub async fn broadcast_active_games(&self, games: &[ActiveGameSummary]) {
        let payload = serde_json::json!({
            "type": "active-games",
            "games": games,
        });
        let msg = Message::Text(payload.to_string().into());
        let mut dead = Vec::new();
        {
            let inner = self.inner.read().await;
            for (&conn_id, tx) in &inner.active_subscribers {
                if tx.send(msg.clone()).is_err() {
                    dead.push(conn_id);
                }
            }
        }
        if !dead.is_empty() {
            let mut inner = self.inner.write().await;
            for id in dead {
                inner.active_subscribers.remove(&id);
            }
        }
    }

    async fn broadcast_to_game(&self, game_id: &str, payload: serde_json::Value) {
        let msg = Message::Text(payload.to_string().into());
        let mut dead = Vec::new();
        {
            let inner = self.inner.read().await;
            if let Some(subs) = inner.game_subscribers.get(game_id) {
                for (&conn_id, tx) in subs {
                    if tx.send(msg.clone()).is_err() {
                        dead.push(conn_id);
                    }
                }
            }
        }
        if !dead.is_empty() {
            let mut inner = self.inner.write().await;
            if let Some(subs) = inner.game_subscribers.get_mut(game_id) {
                for id in dead {
                    subs.remove(&id);
                }
            }
        }
    }
}

pub type SharedHub = Arc<LiveHub>;

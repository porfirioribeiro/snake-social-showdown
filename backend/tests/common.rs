use std::sync::Arc;
use axum_test::TestServer;
use sqlx::any::{AnyPoolOptions, install_default_drivers};

use snake_backend::{
    auth::hash_password,
    db,
    hub::LiveHub,
    models::{GameMode, ScoreEntry},
    routes::build_router,
    state::AppState,
    util::{new_id, now_ms},
};

pub async fn test_server() -> TestServer {
    install_default_drivers();

    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();

    sqlx::migrate!("./migrations").run(&pool).await.unwrap();

    // Seed test users
    let hash = hash_password("password");
    db::users::insert_user(&pool, "u_alice", "alice", &hash).await.unwrap();
    db::users::insert_user(&pool, "u_bruno", "bruno", &hash).await.unwrap();

    // Seed scores
    let base = now_ms();
    for entry in [
        ScoreEntry { id: new_id("s"), user_id: "u_alice".into(), username: "alice".into(), mode: GameMode::Walls, score: 12, created_at: base - 3000 },
        ScoreEntry { id: new_id("s"), user_id: "u_bruno".into(), username: "bruno".into(), mode: GameMode::Walls, score: 30, created_at: base - 2000 },
        ScoreEntry { id: new_id("s"), user_id: "u_alice".into(), username: "alice".into(), mode: GameMode::Wrap, score: 20, created_at: base - 1000 },
    ] {
        db::scores::insert_score(&pool, &entry).await.unwrap();
    }

    let state = AppState { pool, hub: Arc::new(LiveHub::new()) };
    let app = build_router(state);

    TestServer::new(app)
}

pub async fn login(server: &TestServer, username: &str, password: &str) -> String {
    let res = server
        .post("/api/auth/login")
        .json(&serde_json::json!({ "username": username, "password": password }))
        .await;
    res.assert_status_ok();
    res.headers()
        .get("x-access-token")
        .unwrap()
        .to_str()
        .unwrap()
        .to_owned()
}

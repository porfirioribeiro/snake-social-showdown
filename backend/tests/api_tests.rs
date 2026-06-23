mod common;

use axum_test::TestServer;
use serde_json::{Value, json};

async fn server() -> TestServer {
    common::test_server().await
}

fn bearer(res: &axum_test::TestResponse) -> String {
    res.headers()
        .get("x-access-token")
        .expect("X-Access-Token header missing")
        .to_str()
        .unwrap()
        .to_owned()
}

// ── Health ──────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_health_endpoint() {
    let s = server().await;
    let res = s.get("/api/health").await;
    res.assert_status_ok();
    assert_eq!(res.json::<Value>(), json!({ "status": "ok" }));
}

// ── Active games / leaderboard (no auth) ────────────────────────────────────

#[tokio::test]
async fn test_active_games_start_empty_and_leaderboard_is_available() {
    let s = server().await;

    let active = s.get("/api/games/active").await;
    active.assert_status_ok();
    assert_eq!(active.json::<Value>(), json!([]));

    let lb = s
        .get("/api/leaderboard")
        .add_query_param("mode", "walls")
        .add_query_param("limit", "2")
        .await;
    lb.assert_status_ok();
    let scores: Vec<i64> = lb
        .json::<Vec<Value>>()
        .iter()
        .map(|e| e["score"].as_i64().unwrap())
        .collect();
    assert_eq!(scores, vec![30, 12]);
}

// ── Auth ─────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_signup_returns_bearer_token_and_user() {
    let s = server().await;

    let signup = s
        .post("/api/auth/signup")
        .json(&json!({ "username": "celine", "password": "secret" }))
        .await;
    signup.assert_status_ok();
    let body = signup.json::<Value>();
    assert_eq!(body["username"], "celine");
    assert!(body["id"].is_string());
    let token = bearer(&signup);
    assert!(!token.is_empty());

    let me = s
        .get("/api/auth/me")
        .add_header("Authorization", format!("Bearer {token}"))
        .await;
    me.assert_status_ok();
    assert_eq!(me.json::<Value>()["username"], "celine");
}

#[tokio::test]
async fn test_signup_duplicate_returns_400() {
    let s = server().await;
    s.post("/api/auth/signup")
        .json(&json!({ "username": "celine", "password": "secret" }))
        .await
        .assert_status_ok();
    let dup = s
        .post("/api/auth/signup")
        .json(&json!({ "username": "celine", "password": "secret" }))
        .await;
    dup.assert_status(axum::http::StatusCode::BAD_REQUEST);
    assert_eq!(dup.json::<Value>()["message"], "Username already taken");
}

#[tokio::test]
async fn test_login_rejects_bad_password() {
    let s = server().await;
    let bad = s
        .post("/api/auth/login")
        .json(&json!({ "username": "alice", "password": "wrong" }))
        .await;
    bad.assert_status(axum::http::StatusCode::BAD_REQUEST);
    assert_eq!(bad.json::<Value>()["message"], "Invalid username or password");
}

#[tokio::test]
async fn test_login_accepts_seeded_user() {
    let s = server().await;
    let ok = s
        .post("/api/auth/login")
        .json(&json!({ "username": "alice", "password": "password" }))
        .await;
    ok.assert_status_ok();
    let body = ok.json::<Value>();
    assert_eq!(body["id"], "u_alice");
    assert_eq!(body["username"], "alice");
    assert!(!bearer(&ok).is_empty());
}

// ── Protected endpoints require auth ─────────────────────────────────────────

#[tokio::test]
async fn test_protected_endpoints_require_auth() {
    let s = server().await;

    let create = s
        .post("/api/games")
        .json(&json!({ "mode": "walls" }))
        .await;
    create.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    assert_eq!(create.json::<Value>()["message"], "Not authenticated");

    let score = s
        .post("/api/scores")
        .json(&json!({ "mode": "walls", "score": 5 }))
        .await;
    score.assert_status(axum::http::StatusCode::UNAUTHORIZED);
    assert_eq!(score.json::<Value>()["message"], "Not authenticated");
}

// ── Game CRUD ─────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_authenticated_user_can_create_game_and_submit_score() {
    let s = server().await;
    let token = common::login(&s, "alice", "password").await;

    let created = s
        .post("/api/games")
        .add_header("Authorization", format!("Bearer {token}"))
        .json(&json!({ "mode": "wrap" }))
        .await;
    created.assert_status_ok();
    let game = created.json::<Value>();
    assert_eq!(game["username"], "alice");
    assert_eq!(game["mode"], "wrap");

    let submitted = s
        .post("/api/scores")
        .add_header("Authorization", format!("Bearer {token}"))
        .json(&json!({ "mode": "wrap", "score": 99 }))
        .await;
    submitted.assert_status(axum::http::StatusCode::NO_CONTENT);

    let lb = s
        .get("/api/leaderboard")
        .add_query_param("mode", "wrap")
        .add_query_param("limit", "1")
        .await;
    assert_eq!(lb.json::<Value>()[0]["score"], 99);
}

#[tokio::test]
async fn test_creating_game_replaces_users_existing_live_game() {
    let s = server().await;
    let token = common::login(&s, "alice", "password").await;

    let first = s
        .post("/api/games")
        .add_header("Authorization", format!("Bearer {token}"))
        .json(&json!({ "mode": "walls" }))
        .await
        .json::<Value>();

    let second = s
        .post("/api/games")
        .add_header("Authorization", format!("Bearer {token}"))
        .json(&json!({ "mode": "wrap" }))
        .await
        .json::<Value>();

    assert_ne!(first["id"], second["id"]);

    let fetched_first = s.get(&format!("/api/games/{}", first["id"].as_str().unwrap())).await;
    assert_eq!(fetched_first.json::<Value>(), Value::Null);

    let fetched_second = s.get(&format!("/api/games/{}", second["id"].as_str().unwrap())).await;
    assert_eq!(fetched_second.json::<Value>()["mode"], "wrap");

    let active = s.get("/api/games/active").await.json::<Vec<Value>>();
    assert_eq!(active.len(), 1);
    assert_eq!(active[0]["id"], second["id"]);
}

#[tokio::test]
async fn test_abandon_game_removes_it() {
    let s = server().await;
    let token = common::login(&s, "alice", "password").await;

    let game = s
        .post("/api/games")
        .add_header("Authorization", format!("Bearer {token}"))
        .json(&json!({ "mode": "walls" }))
        .await
        .json::<Value>();

    let abandoned = s
        .post(&format!("/api/games/{}/abandon", game["id"].as_str().unwrap()))
        .add_header("Authorization", format!("Bearer {token}"))
        .await;
    abandoned.assert_status(axum::http::StatusCode::NO_CONTENT);

    let fetched = s.get(&format!("/api/games/{}", game["id"].as_str().unwrap())).await;
    assert_eq!(fetched.json::<Value>(), Value::Null);

    let active = s.get("/api/games/active").await.json::<Vec<Value>>();
    assert_eq!(active, vec![] as Vec<Value>);
}

// ── Validation ────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_short_password_rejected_on_signup() {
    let s = server().await;
    let res = s
        .post("/api/auth/signup")
        .json(&json!({ "username": "x", "password": "123" }))
        .await;
    res.assert_status(axum::http::StatusCode::BAD_REQUEST);
    assert!(res.json::<Value>()["message"].is_string());
}

// ── me returns null when not authenticated ────────────────────────────────────

#[tokio::test]
async fn test_me_returns_null_when_not_authenticated() {
    let s = server().await;
    let res = s.get("/api/auth/me").await;
    res.assert_status_ok();
    assert_eq!(res.json::<Value>(), Value::Null);
}

// ── Logout ────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_logout_invalidates_token() {
    let s = server().await;
    let token = common::login(&s, "alice", "password").await;

    // Token works before logout
    let me = s
        .get("/api/auth/me")
        .add_header("Authorization", format!("Bearer {token}"))
        .await;
    me.assert_status_ok();
    assert_eq!(me.json::<Value>()["username"], "alice");

    // Logout
    let logout = s
        .post("/api/auth/logout")
        .add_header("Authorization", format!("Bearer {token}"))
        .await;
    logout.assert_status(axum::http::StatusCode::NO_CONTENT);

    // Token no longer valid
    let me_after = s
        .get("/api/auth/me")
        .add_header("Authorization", format!("Bearer {token}"))
        .await;
    me_after.assert_status_ok();
    assert_eq!(me_after.json::<Value>(), Value::Null);
}

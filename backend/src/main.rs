use std::net::SocketAddr;

use snake_backend::{
    auth::hash_password,
    config::Config,
    db,
    models::{GameMode, ScoreEntry},
    routes::build_router,
    state::AppState,
    util::{new_id, now_ms},
};
use sqlx::any::AnyPoolOptions;
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cfg = Config::from_env();

    // Install drivers for both SQLite and Postgres so AnyPool can connect to either.
    sqlx::any::install_default_drivers();

    let pool = AnyPoolOptions::new()
        .max_connections(5)
        .connect(&cfg.database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    if cfg.seed {
        seed_if_empty(&pool).await?;
    }

    let state = AppState::new(pool);
    let mut app = build_router(state);

    app = app.layer(
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
            .expose_headers(Any),
    );

    if let Some(static_dir) = &cfg.frontend_static_dir {
        let spa_fallback = ServeFile::new(format!("{static_dir}/_shell.html"));
        let serve = ServeDir::new(static_dir).fallback(spa_fallback);
        app = app.fallback_service(serve);
    }

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    println!("Listening on http://{addr}");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn seed_if_empty(pool: &sqlx::AnyPool) -> anyhow::Result<()> {
    if db::users::user_exists(pool).await? {
        return Ok(());
    }

    let password_hash = hash_password("password");
    let alice = db::users::insert_user(pool, "u_alice", "alice", &password_hash).await?;
    let bruno = db::users::insert_user(pool, "u_bruno", "bruno", &password_hash).await?;
    let celine = db::users::insert_user(pool, "u_celine", "celine", &password_hash).await?;

    let base = now_ms();
    let entries: Vec<(&snake_backend::models::User, GameMode, i64, i64)> = vec![
        (&alice, GameMode::Walls, 42, 90_000),
        (&bruno, GameMode::Wrap, 57, 80_000),
        (&celine, GameMode::Walls, 31, 70_000),
        (&alice, GameMode::Wrap, 28, 60_000),
        (&bruno, GameMode::Walls, 24, 50_000),
    ];

    for (user, mode, score, offset) in entries {
        let entry = ScoreEntry {
            id: new_id("score"),
            user_id: user.id.clone(),
            username: user.username.clone(),
            mode,
            score,
            created_at: base - offset,
        };
        db::scores::insert_score(pool, &entry).await?;
    }

    Ok(())
}

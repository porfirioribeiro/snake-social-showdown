use std::env;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub frontend_static_dir: Option<String>,
    pub seed: bool,
}

impl Config {
    pub fn from_env() -> Self {
        let _ = dotenvy::dotenv();
        let raw_url = env::var("DATABASE_URL")
            .unwrap_or_else(|_| "sqlite:///./snake.db".to_string());
        // Strip SQLAlchemy driver suffixes like postgresql+psycopg:// → postgresql://
        let database_url = if let Some(rest) = raw_url.strip_prefix("postgresql+") {
            format!("postgresql://{}", rest.splitn(2, "://").nth(1).unwrap_or(rest))
        } else if let Some(rest) = raw_url.strip_prefix("postgres+") {
            format!("postgres://{}", rest.splitn(2, "://").nth(1).unwrap_or(rest))
        } else {
            raw_url
        };
        // For SQLite file URLs, append ?mode=rwc so the DB is created if it doesn't exist.
        // AnyPool doesn't support SqliteConnectOptions.create_if_missing(), so we use the URI flag.
        let database_url = if database_url.starts_with("sqlite:")
            && !database_url.contains(":memory:")
            && !database_url.contains("mode=")
        {
            if database_url.contains('?') {
                format!("{database_url}&mode=rwc")
            } else {
                format!("{database_url}?mode=rwc")
            }
        } else {
            database_url
        };
        Self {
            database_url,
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8000),
            frontend_static_dir: env::var("FRONTEND_STATIC_DIR").ok(),
            seed: env::var("SEED_DB").map(|v| v == "1" || v == "true").unwrap_or(true),
        }
    }
}

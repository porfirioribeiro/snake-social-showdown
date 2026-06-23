use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GameMode {
    Walls,
    Wrap,
}

impl GameMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            GameMode::Walls => "walls",
            GameMode::Wrap => "wrap",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "walls" => Some(GameMode::Walls),
            "wrap" => Some(GameMode::Wrap),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub x: i64,
    pub y: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameState {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub username: String,
    pub mode: GameMode,
    pub width: i64,
    pub height: i64,
    pub snake: Vec<Cell>,
    pub food: Cell,
    pub dir: Cell,
    pub score: i64,
    pub alive: bool,
    #[serde(rename = "startedAt")]
    pub started_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveGameSummary {
    pub id: String,
    pub username: String,
    pub mode: GameMode,
    pub score: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreEntry {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    pub username: String,
    pub mode: GameMode,
    pub score: i64,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

// Request types

#[derive(Debug, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct SignupRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateGameRequest {
    pub mode: GameMode,
}

#[derive(Debug, Deserialize)]
pub struct SubmitScoreRequest {
    pub score: i64,
    pub mode: GameMode,
}

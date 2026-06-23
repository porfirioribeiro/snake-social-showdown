use std::sync::Arc;
use sqlx::AnyPool;
use crate::hub::LiveHub;

#[derive(Clone)]
pub struct AppState {
    pub pool: AnyPool,
    pub hub: Arc<LiveHub>,
}

impl AppState {
    pub fn new(pool: AnyPool) -> Self {
        Self {
            pool,
            hub: Arc::new(LiveHub::new()),
        }
    }
}

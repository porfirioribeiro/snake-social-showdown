use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use axum_extra::extract::CookieJar;

use crate::{db, models::User, state::AppState};

fn token_from_authorization(value: Option<&str>) -> Option<String> {
    let v = value?;
    let (scheme, token) = v.split_once(' ')?;
    if scheme.eq_ignore_ascii_case("bearer") && !token.is_empty() {
        Some(token.to_owned())
    } else {
        None
    }
}

pub struct OptionalUser(pub Option<User>);
pub struct RequiredUser(pub User);

impl FromRequestParts<AppState> for OptionalUser {
    type Rejection = (StatusCode, axum::Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let auth_value = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok());
        let token_from_header = token_from_authorization(auth_value);

        let jar = CookieJar::from_headers(&parts.headers);
        let token_from_cookie = jar.get("session").map(|c| c.value().to_owned());

        let token = token_from_header.or(token_from_cookie);

        let user = match token {
            Some(t) => db::sessions::user_for_token(&state.pool, &t)
                .await
                .unwrap_or(None),
            None => None,
        };

        Ok(OptionalUser(user))
    }
}

impl FromRequestParts<AppState> for RequiredUser {
    type Rejection = (StatusCode, axum::Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> Result<Self, Self::Rejection> {
        let OptionalUser(maybe) = OptionalUser::from_request_parts(parts, state).await?;
        match maybe {
            Some(u) => Ok(RequiredUser(u)),
            None => Err((
                StatusCode::UNAUTHORIZED,
                axum::Json(serde_json::json!({ "message": "Not authenticated" })),
            )),
        }
    }
}

pub fn create_token() -> String {
    let mut bytes = [0u8; 32];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut bytes);
    hex::encode(bytes)
}

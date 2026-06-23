use axum::{
    Json,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
};
use axum_extra::extract::{
    CookieJar,
    cookie::{Cookie, SameSite},
};
use serde_json::json;

use crate::{
    auth::{OptionalUser, create_token, hash_password, verify_password},
    db,
    error::AppError,
    models::{Credentials, SignupRequest, User},
    state::AppState,
    util::new_id,
};

fn session_cookie(token: &str) -> Cookie<'static> {
    Cookie::build(("session", token.to_owned()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .max_age(time::Duration::seconds(60 * 60 * 24 * 7))
        .build()
}

async fn attach_session(
    pool: &sqlx::AnyPool,
    user: &User,
) -> Result<(String, CookieJar), AppError> {
    let token = create_token();
    db::sessions::create_session(pool, &token, &user.id).await?;
    let jar = CookieJar::new().add(session_cookie(&token));
    Ok((token, jar))
}

pub async fn me(OptionalUser(user): OptionalUser) -> impl IntoResponse {
    Json(user)
}

pub async fn login(
    State(state): State<AppState>,
    Json(credentials): Json<Credentials>,
) -> Result<Response, AppError> {
    if credentials.username.is_empty() || credentials.password.is_empty() {
        return Err(AppError::BadRequest("Username and password are required".into()));
    }

    let stored = db::users::find_by_username(&state.pool, &credentials.username).await?;
    let valid = stored
        .as_ref()
        .map(|u| verify_password(&credentials.password, &u.password_hash))
        .unwrap_or(false);

    if !valid {
        return Err(AppError::BadRequest("Invalid username or password".into()));
    }

    let stored = stored.unwrap();
    let user = User { id: stored.id, username: stored.username };
    let (token, jar) = attach_session(&state.pool, &user).await?;

    let mut response = (jar, Json(json!(user))).into_response();
    response.headers_mut().insert(
        "Authorization",
        format!("Bearer {token}").parse().unwrap(),
    );
    response.headers_mut().insert(
        "X-Access-Token",
        token.parse().unwrap(),
    );
    Ok(response)
}

pub async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> Result<Response, AppError> {
    if payload.username.trim().is_empty() {
        return Err(AppError::BadRequest("Username is required".into()));
    }
    if payload.password.len() < 4 {
        return Err(AppError::BadRequest("Password must be at least 4 characters".into()));
    }

    let id = new_id("user");
    let hash = hash_password(&payload.password);
    let username = payload.username.trim().to_string();

    let user = db::users::insert_user(&state.pool, &id, &username, &hash)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(ref dbe) = e {
                if dbe.message().contains("UNIQUE") {
                    return AppError::BadRequest("Username already taken".into());
                }
            }
            AppError::Db(e)
        })?;

    let (token, jar) = attach_session(&state.pool, &user).await?;

    let mut response = (StatusCode::OK, jar, Json(json!(user))).into_response();
    response.headers_mut().insert(
        "Authorization",
        format!("Bearer {token}").parse().unwrap(),
    );
    response.headers_mut().insert(
        "X-Access-Token",
        token.parse().unwrap(),
    );
    Ok(response)
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
) -> impl IntoResponse {
    let token_from_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| {
            let (scheme, token) = v.split_once(' ')?;
            if scheme.eq_ignore_ascii_case("bearer") { Some(token.to_owned()) } else { None }
        });

    let token = token_from_header
        .or_else(|| jar.get("session").map(|c| c.value().to_owned()));

    if let Some(t) = token {
        let _ = db::sessions::delete_session(&state.pool, &t).await;
    }

    let jar = jar.remove(Cookie::from("session"));
    (StatusCode::NO_CONTENT, jar)
}

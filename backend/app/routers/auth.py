from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Header, HTTPException, Response, status

from app.auth import (
    create_token,
    optional_current_user,
    token_from_authorization,
)
from app.models import Credentials, SignupRequest, User
from app.passwords import hash_password, verify_password
from app.store import Store, get_store

router = APIRouter(prefix="/auth", tags=["Auth"])


def attach_session(response: Response, store: Store, user: User) -> None:
    token = create_token()
    store.create_session(user.id, token)
    response.headers["Authorization"] = f"Bearer {token}"
    response.headers["X-Access-Token"] = token
    response.set_cookie(
        "session",
        token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
    )


@router.get("/me", response_model=User | None)
def get_current_user(current_user: User | None = Depends(optional_current_user)) -> User | None:
    return current_user


@router.post("/login", response_model=User)
def login(credentials: Credentials, response: Response, store: Store = Depends(get_store)) -> User:
    user = store.find_user_by_username(credentials.username)
    if user is None or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    public = User(id=user.id, username=user.username)
    attach_session(response, store, public)
    return public


@router.post("/signup", response_model=User)
def signup(payload: SignupRequest, response: Response, store: Store = Depends(get_store)) -> User:
    try:
        user = store.add_user(payload.username, hash_password(payload.password))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    attach_session(response, store, user)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    authorization: Annotated[str | None, Header()] = None,
    session: Annotated[str | None, Cookie()] = None,
    store: Store = Depends(get_store),
) -> None:
    store.clear_session(token_from_authorization(authorization) or session)
    response.delete_cookie("session")

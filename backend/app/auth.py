import secrets
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status

from app.models import User
from app.store import Store, get_store


def create_token() -> str:
    return secrets.token_urlsafe(32)


def token_from_authorization(value: str | None) -> str | None:
    if not value:
        return None
    scheme, _, token = value.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def optional_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session: Annotated[str | None, Cookie()] = None,
    store: Store = Depends(get_store),
) -> User | None:
    token = token_from_authorization(authorization) or session
    if not token:
        return None
    return store.user_for_token(token)


def require_current_user(
    current_user: User | None = Depends(optional_current_user),
) -> User:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

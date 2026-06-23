import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.auth import require_current_user
from app.models import ActiveGameSummary, CreateGameRequest, GameState, User
from app.store import Store, get_store, make_game, now_ms

router = APIRouter(prefix="/games", tags=["Games"])


def sse_event(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, separators=(',', ':'))}\n\n"


@router.post("", response_model=GameState)
def create_game(
    payload: CreateGameRequest,
    current_user: User = Depends(require_current_user),
    store: Store = Depends(get_store),
) -> GameState:
    game = make_game(current_user, payload.mode)
    store.games[game.id] = game
    return game


@router.get("/active", response_model=list[ActiveGameSummary])
def list_active_games(store: Store = Depends(get_store)) -> list[ActiveGameSummary]:
    return store.active_games()


@router.get("/active/events")
def subscribe_active_games(store: Store = Depends(get_store)) -> StreamingResponse:
    async def stream():
        while True:
            payload = {"type": "active-games", "games": [game.model_dump(mode="json") for game in store.active_games()]}
            yield sse_event("active-games", payload)
            await asyncio.sleep(2)

    return StreamingResponse(stream(), media_type="text/event-stream")


@router.get("/{game_id}", response_model=GameState | None)
def get_game(game_id: str, store: Store = Depends(get_store)) -> GameState | None:
    return store.games.get(game_id)


@router.put("/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_game(
    game_id: str,
    state: GameState,
    current_user: User = Depends(require_current_user),
    store: Store = Depends(get_store),
) -> None:
    existing = store.games.get(game_id)
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    if state.id != game_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Game id mismatch")
    if existing.userId != current_user.id or state.userId != current_user.id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authorized for this game")
    store.games[game_id] = state.model_copy(update={"updatedAt": now_ms()})


@router.get("/{game_id}/events")
def subscribe_game(game_id: str, store: Store = Depends(get_store)) -> StreamingResponse:
    if game_id not in store.games:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")

    async def stream():
        while True:
            game = store.games.get(game_id)
            if game is None:
                break
            yield sse_event("game-state", {"type": "game-state", "game": game.model_dump(mode="json")})
            await asyncio.sleep(1)

    return StreamingResponse(stream(), media_type="text/event-stream")

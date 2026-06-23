import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError

from app.auth import require_current_user
from app.live import live_hub
from app.models import ActiveGameSummary, CreateGameRequest, GameState, User
from app.store import Store, get_store, make_game

router = APIRouter(prefix="/games", tags=["Games"])


def current_user_from_websocket(websocket: WebSocket, store: Store) -> User | None:
    token = websocket.query_params.get("token") or websocket.cookies.get("session")
    return store.user_for_token(token) if token else None


@router.post("", response_model=GameState)
async def create_game(
    payload: CreateGameRequest,
    current_user: User = Depends(require_current_user),
    store: Store = Depends(get_store),
) -> GameState:
    replaced_game_ids = store.active_game_ids_for_user(current_user.id)
    game = make_game(current_user, payload.mode)
    created = store.create_game(game)
    for game_id in replaced_game_ids:
        await live_hub.broadcast_game_deleted(game_id)
    await live_hub.broadcast_active_games(store.active_games())
    return created


@router.get("/active", response_model=list[ActiveGameSummary])
def list_active_games(store: Store = Depends(get_store)) -> list[ActiveGameSummary]:
    return store.active_games()


@router.websocket("/active/ws")
async def active_games_ws(websocket: WebSocket, store: Store = Depends(get_store)) -> None:
    await live_hub.connect_active(websocket)
    try:
        await websocket.send_json(
            {
                "type": "active-games",
                "games": [game.model_dump(mode="json") for game in store.active_games()],
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        live_hub.disconnect_active(websocket)


@router.get("/{game_id}", response_model=GameState | None)
def get_game(game_id: str, store: Store = Depends(get_store)) -> GameState | None:
    return store.get_game(game_id)


@router.post("/{game_id}/abandon", status_code=status.HTTP_204_NO_CONTENT)
async def abandon_game(
    game_id: str,
    current_user: User = Depends(require_current_user),
    store: Store = Depends(get_store),
) -> None:
    deleted = store.delete_game(game_id, current_user.id)
    if deleted:
        await live_hub.broadcast_game_deleted(game_id)
        await live_hub.broadcast_active_games(store.active_games())


@router.websocket("/{game_id}/ws")
async def game_ws(game_id: str, websocket: WebSocket, store: Store = Depends(get_store)) -> None:
    game = store.get_game(game_id)
    if game is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await live_hub.connect_game(game_id, websocket)
    try:
        await websocket.send_json({"type": "game-state", "game": game.model_dump(mode="json")})
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
                if message.get("type") != "game-update":
                    continue
                state = GameState.model_validate(message.get("game"))
            except (json.JSONDecodeError, AttributeError, ValidationError):
                await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                return

            current_user = current_user_from_websocket(websocket, store)
            existing = store.get_game(game_id)
            if (
                current_user is None
                or existing is None
                or state.id != game_id
                or existing.userId != current_user.id
                or state.userId != current_user.id
            ):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

            updated = store.update_game(game_id, state)
            if updated is None:
                await live_hub.broadcast_game_deleted(game_id)
            else:
                await live_hub.broadcast_game_state(updated)
            await live_hub.broadcast_active_games(store.active_games())
    except WebSocketDisconnect:
        pass
    finally:
        live_hub.disconnect_game(game_id, websocket)

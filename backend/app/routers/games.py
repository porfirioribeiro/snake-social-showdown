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


def active_games_event(store: Store) -> dict:
    return {
        "type": "active-games",
        "games": [game.model_dump(mode="json") for game in store.active_games()],
    }


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


@router.websocket("/ws")
async def games_ws(websocket: WebSocket, store: Store = Depends(get_store)) -> None:
    await live_hub.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                message = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                return

            message_type = message.get("type") if isinstance(message, dict) else None

            if message_type == "subscribe-active":
                live_hub.subscribe_active(websocket)
                await websocket.send_json(active_games_event(store))
                continue

            if message_type == "subscribe-game":
                game_id = message.get("gameId")
                if not isinstance(game_id, str):
                    await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                    return
                live_hub.subscribe_game(game_id, websocket)
                game = store.get_game(game_id)
                if game is None:
                    await websocket.send_json({"type": "game-deleted", "gameId": game_id})
                else:
                    await websocket.send_json({"type": "game-state", "game": game.model_dump(mode="json")})
                continue

            if message_type != "game-update":
                continue

            try:
                state = GameState.model_validate(message.get("game"))
            except (AttributeError, ValidationError):
                await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                return

            current_user = current_user_from_websocket(websocket, store)
            existing = store.get_game(state.id)
            if (
                current_user is None
                or existing is None
                or existing.userId != current_user.id
                or state.userId != current_user.id
            ):
                await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                return

            updated = store.update_game(state.id, state)
            if updated is None:
                await live_hub.broadcast_game_deleted(state.id)
            else:
                await live_hub.broadcast_game_state(updated)
            await live_hub.broadcast_active_games(store.active_games())
    except WebSocketDisconnect:
        pass
    finally:
        live_hub.disconnect(websocket)

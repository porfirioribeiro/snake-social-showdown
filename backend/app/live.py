from collections import defaultdict

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.models import ActiveGameSummary, GameState


class LiveHub:
    def __init__(self) -> None:
        self.game_clients: dict[str, set[WebSocket]] = defaultdict(set)
        self.active_clients: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()

    def subscribe_game(self, game_id: str, websocket: WebSocket) -> None:
        self.game_clients[game_id].add(websocket)

    def disconnect_game(self, game_id: str, websocket: WebSocket) -> None:
        clients = self.game_clients.get(game_id)
        if clients is None:
            return
        clients.discard(websocket)
        if not clients:
            self.game_clients.pop(game_id, None)

    def subscribe_active(self, websocket: WebSocket) -> None:
        self.active_clients.add(websocket)

    def disconnect_active(self, websocket: WebSocket) -> None:
        self.active_clients.discard(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.disconnect_active(websocket)
        for game_id in tuple(self.game_clients):
            self.disconnect_game(game_id, websocket)

    async def broadcast_game_state(self, game: GameState) -> None:
        await self._broadcast_game(
            game.id,
            {"type": "game-state", "game": game.model_dump(mode="json")},
        )

    async def broadcast_game_deleted(self, game_id: str) -> None:
        await self._broadcast_game(game_id, {"type": "game-deleted", "gameId": game_id})

    async def broadcast_active_games(self, games: list[ActiveGameSummary]) -> None:
        await self._broadcast(
            self.active_clients,
            {"type": "active-games", "games": [game.model_dump(mode="json") for game in games]},
        )

    async def _broadcast_game(self, game_id: str, payload: dict) -> None:
        clients = self.game_clients.get(game_id)
        if clients is None:
            return
        await self._broadcast(clients, payload)

    async def _broadcast(self, clients: set[WebSocket], payload: dict) -> None:
        disconnected: list[WebSocket] = []
        for websocket in tuple(clients):
            try:
                await websocket.send_json(payload)
            except WebSocketDisconnect:
                disconnected.append(websocket)
            except RuntimeError:
                disconnected.append(websocket)

        for websocket in disconnected:
            clients.discard(websocket)


live_hub = LiveHub()

from fastapi import APIRouter, Depends, Query, status

from app.auth import require_current_user
from app.models import GameMode, ScoreEntry, SubmitScoreRequest, User
from app.store import Store, get_store, new_id, now_ms

router = APIRouter(tags=["Scores"])


@router.post("/scores", status_code=status.HTTP_204_NO_CONTENT)
def submit_score(
    payload: SubmitScoreRequest,
    current_user: User = Depends(require_current_user),
    store: Store = Depends(get_store),
) -> None:
    store.add_score(
        ScoreEntry(
            id=new_id("score"),
            userId=current_user.id,
            username=current_user.username,
            mode=payload.mode,
            score=payload.score,
            createdAt=now_ms(),
        )
    )


@router.get("/leaderboard", response_model=list[ScoreEntry])
def get_leaderboard(
    mode: GameMode,
    limit: int = Query(default=10, ge=1),
    store: Store = Depends(get_store),
) -> list[ScoreEntry]:
    return store.leaderboard(mode, limit)

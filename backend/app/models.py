from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GameMode(StrEnum):
    walls = "walls"
    wrap = "wrap"


class ErrorResponse(ApiModel):
    message: str


class User(ApiModel):
    id: str
    username: str


class StoredUser(User):
    password_hash: str


class Credentials(ApiModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class SignupRequest(ApiModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=4)


class CreateGameRequest(ApiModel):
    mode: GameMode


class SubmitScoreRequest(ApiModel):
    score: int = Field(ge=0)
    mode: GameMode


class Cell(ApiModel):
    x: int
    y: int


class GameState(ApiModel):
    id: str
    userId: str
    username: str
    mode: GameMode
    width: int = Field(ge=1)
    height: int = Field(ge=1)
    snake: list[Cell] = Field(min_length=1)
    food: Cell
    dir: Cell
    score: int = Field(ge=0)
    alive: bool
    startedAt: int
    updatedAt: int


class ActiveGameSummary(ApiModel):
    id: str
    username: str
    mode: GameMode
    score: int = Field(ge=0)
    alive: bool


class ScoreEntry(ApiModel):
    id: str
    userId: str
    username: str
    mode: GameMode
    score: int = Field(ge=0)
    createdAt: int

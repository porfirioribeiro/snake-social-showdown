from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routers import auth, games, scores


def create_app() -> FastAPI:
    app = FastAPI(title="Snake Social Showdown API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Authorization", "X-Access-Token"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"message": "Invalid request"},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse(
            status_code=exc.status_code,
            content={"message": message},
            headers=exc.headers,
        )

    @app.get("/api/health", tags=["Health"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth.router, prefix="/api")
    app.include_router(games.router, prefix="/api")
    app.include_router(scores.router, prefix="/api")
    return app


app = create_app()

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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

    static_dir = Path(os.getenv("FRONTEND_STATIC_DIR", Path(__file__).resolve().parents[1] / "static"))
    index_file = static_dir / "_shell.html"
    assets_dir = static_dir / "assets"
    if index_file.exists() and assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_frontend(full_path: str) -> FileResponse:
            requested_file = (static_dir / full_path).resolve()
            if (
                requested_file.is_file()
                and static_dir.resolve() in requested_file.parents
                and requested_file != index_file
            ):
                return FileResponse(requested_file)
            return FileResponse(index_file)

    return app


app = create_app()

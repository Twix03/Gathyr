"""FastAPI application."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import router
from .config import settings
from .rooms import manager

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("gathyr")


def _remove_from_livekit(room_code: str, participant_id: str) -> None:
    """Make sure a removed participant also loses their media connection."""

    async def run() -> None:
        try:
            from livekit.api import LiveKitAPI, RoomParticipantIdentity
            lk = LiveKitAPI(settings.livekit_url, settings.livekit_api_key, settings.livekit_api_secret)
            try:
                await lk.room.remove_participant(RoomParticipantIdentity(room=room_code, identity=participant_id))
            finally:
                await lk.aclose()
        except Exception as e:  # participant may already be gone from the media room
            log.debug("livekit remove %s: %s", participant_id[:8], e)

    asyncio.get_running_loop().create_task(run())


@asynccontextmanager
async def lifespan(app: FastAPI):
    manager.on_participant_removed = _remove_from_livekit
    gc = asyncio.create_task(manager.run_gc())
    yield
    gc.cancel()


app = FastAPI(title="Gathyr", lifespan=lifespan, docs_url="/docs" if settings.debug else None,
              redoc_url=None, openapi_url="/openapi.json" if settings.debug else None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(router)

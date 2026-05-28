"""Main FastAPI application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Handle imports for both direct execution and package import
try:
    # Try relative imports first (works when imported as package)
    from config import settings
    from routers import rooms, websocket
except ImportError:
    # Fall back to absolute imports (works when run directly)
    import sys
    from pathlib import Path
    parent_dir = Path(__file__).parent.parent
    if str(parent_dir) not in sys.path:
        sys.path.insert(0, str(parent_dir))
    from Backend.config import settings
    from Backend.routers import rooms, websocket

# Create FastAPI app
app = FastAPI(
    title="Gathyr Backend API",
    description="FastAPI WebSocket backend for real-time video/audio calling and game sessions",
    version="1.0.0",
)

from fastapi.middleware.cors import CORSMiddleware

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(rooms.router)
app.include_router(websocket.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Gathyr Backend API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    # Run as Backend.main so package structure is recognized
    uvicorn.run(
        "Backend.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )


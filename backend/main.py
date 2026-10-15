from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import interview, report

logger = logging.getLogger("ai_interview_coach")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for application startup and shutdown."""
    print("AI Interview Coach API started successfully")
    yield


app = FastAPI(
    title="AI Interview Coach API",
    description="Backend API for AI Interview Coach powered by Groq and FastAPI",
    version="1.0.0",
    lifespan=lifespan,
)


# Global unhandled exception handler
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a user-friendly JSON response instead of a raw traceback."""
    # Preserve explicit HTTPExceptions
    if isinstance(exc, HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    logger.error(f"Unhandled exception occurred at {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request. Please try again later.",
            "detail": str(exc),
        },
    )


# Configure CORS middleware allowing all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers with their specified prefixes
app.include_router(interview.router, prefix="/api/interview")
app.include_router(report.router, prefix="/api/report")


@app.get("/")
def health_check():
    """Root endpoint for health checking."""
    return {
        "status": "healthy",
        "message": "AI Interview Coach API is running",
    }

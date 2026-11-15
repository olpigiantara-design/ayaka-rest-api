import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .routers import auth, users, api_keys, analytics, endpoints

app = FastAPI(
    title="AYAKA REST API",
    description="One API. Unlimited Possibilities. Powered by Ayaka Sync.",
    version="1.0.0",
    docs_url="/api/openapi/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

FRONTEND_URL = os.environ.get("FRONTEND_URL", "*")
allowed = [FRONTEND_URL] if FRONTEND_URL != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"success": False, "message": "Internal server error", "code": 500})


@app.get("/api/health")
def health():
    return {"success": True, "status": "ok", "service": "AYAKA REST API"}


@app.get("/api/docs/endpoints")
def docs_endpoints():
    return {
        "success": True,
        "endpoints": [
            {"method": "GET", "path": "/api/v1/example", "desc": "Example / health check", "auth": "X-API-Key"},
            {"method": "GET", "path": "/api/v1/user", "desc": "Returns API key owner info", "auth": "X-API-Key"},
            {"method": "GET", "path": "/api/v1/keys/info", "desc": "Returns current key metadata", "auth": "X-API-Key"},
        ],
        "rate_limit": "60 requests per minute per API key",
    }


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(api_keys.router)
app.include_router(analytics.router)
app.include_router(endpoints.router)
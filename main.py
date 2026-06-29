from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pathlib import Path
from routers.chat import router as chat_router

# Load .env from the same directory as this file, regardless of cwd
load_dotenv(dotenv_path=Path(__file__).parent / ".env", override=True)

app = FastAPI(title="BuyRight AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)

# Static files with no-cache headers
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        return response

app.mount("/static", NoCacheStaticFiles(directory="frontend"), name="static")


@app.get("/")
async def root():
    return FileResponse(
        "frontend/index.html",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
    )

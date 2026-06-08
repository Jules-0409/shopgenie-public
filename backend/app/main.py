import logging
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException

from app.config import Settings, get_settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.schemas import ChatRequest, ChatResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).resolve().parent / "app.log", mode="a"),
    ],
)

app = FastAPI(title="ShopGenie API", version="0.1.0")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, settings: Settings = Depends(get_settings)) -> ChatResponse:
    try:
        return await DeepSeekClient(settings).chat(request)
    except DeepSeekError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

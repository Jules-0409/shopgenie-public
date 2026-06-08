import logging
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.memory import UserProfile, get_profile, save_profile, delete_profile
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
        profile = get_profile()
        return await DeepSeekClient(settings, profile=profile).chat(request)
    except DeepSeekError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


class ProfileResponse(BaseModel):
    profile: UserProfile | None
    exists: bool


class ProfileUpdateRequest(BaseModel):
    brand_name: str = ""
    category: str = ""
    target_audience: str = ""
    tone: str = ""
    style_preferences: list[str] = Field(default_factory=list)
    platforms: list[str] = Field(default_factory=list)
    taboo_words: list[str] = Field(default_factory=list)
    extra_notes: str = ""


@app.get("/api/profile", response_model=ProfileResponse)
async def api_get_profile() -> ProfileResponse:
    profile = get_profile()
    return ProfileResponse(profile=profile, exists=profile is not None)


@app.post("/api/profile", response_model=ProfileResponse)
async def api_save_profile(req: ProfileUpdateRequest) -> ProfileResponse:
    profile = UserProfile(
        id="default",
        brand_name=req.brand_name,
        category=req.category,
        target_audience=req.target_audience,
        tone=req.tone,
        style_preferences=req.style_preferences,
        platforms=req.platforms,
        taboo_words=req.taboo_words,
        extra_notes=req.extra_notes,
    )
    save_profile(profile)
    return ProfileResponse(profile=profile, exists=True)


@app.delete("/api/profile")
async def api_delete_profile() -> dict[str, bool]:
    deleted = delete_profile()
    return {"deleted": deleted}

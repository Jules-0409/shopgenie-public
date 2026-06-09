from pathlib import Path

from fastapi.testclient import TestClient

import app.memory as memory
from app.main import app


def test_profile_api_round_trip(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "profile.db"
    payload = {
        "brand_name": "测试商家",
        "category": "家居用品",
        "tone": "温暖实用",
        "style_preferences": ["自然表达"],
        "platforms": ["xhs", "dy"],
        "taboo_words": ["速效"],
    }

    with TestClient(app) as client:
        saved = client.post("/api/profile", json=payload)
        loaded = client.get("/api/profile")
        deleted = client.delete("/api/profile")

    assert saved.status_code == 200
    assert saved.json()["profile"]["brand_name"] == "测试商家"
    assert loaded.json()["profile"]["platforms"] == ["xhs", "dy"]
    assert deleted.json() == {"deleted": True}


def test_profile_api_rejects_invalid_platform(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "profile.db"

    with TestClient(app) as client:
        response = client.post("/api/profile", json={"platforms": ["unknown"]})

    assert response.status_code == 422


def test_profile_api_rejects_oversized_brand_name(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "profile.db"

    with TestClient(app) as client:
        response = client.post("/api/profile", json={"brand_name": "长" * 201})

    assert response.status_code == 422

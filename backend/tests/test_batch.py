from pathlib import Path

from fastapi.testclient import TestClient

import app.memory as memory
from app.deepseek import DeepSeekClient
from app.main import app
from app.schemas import ChatRequest, ChatResponse, GeneratedContent, Usage


def _fake_response(request: ChatRequest) -> ChatResponse:
    result = GeneratedContent(platform=request.platform, title=f"{request.platform.value} 标题", body="正文内容", tags=["标签"], sections=[])
    return ChatResponse(message="已生成", result=result, model="test", usage=Usage())


def test_batch_generate_fans_out(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "batch.db"

    async def fake_chat(self, request: ChatRequest) -> ChatResponse:
        return _fake_response(request)

    monkeypatch.setattr(DeepSeekClient, "chat", fake_chat)

    with TestClient(app) as client:
        resp = client.post("/api/batch/generate", json={"brief": "保温杯，主打轻量", "platforms": ["xhs", "dy", "amazon"]})
        assert resp.status_code == 200
        items = resp.json()
        assert [i["platform"] for i in items] == ["xhs", "dy", "amazon"]
        assert all(i["result"] is not None and i["asset_id"] for i in items)  # 各自存了资产
        # 三条内容资产落库
        assert len(client.get("/api/content").json()) == 3


def test_batch_rejects_studio_only(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "batch2.db"
    with TestClient(app) as client:
        assert client.post("/api/batch/generate", json={"brief": "x", "platforms": ["studio"]}).status_code == 422


def test_batch_dedupes_and_drops_studio(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "batch3.db"

    async def fake_chat(self, request: ChatRequest) -> ChatResponse:
        return _fake_response(request)

    monkeypatch.setattr(DeepSeekClient, "chat", fake_chat)
    with TestClient(app) as client:
        resp = client.post("/api/batch/generate", json={"brief": "x", "platforms": ["xhs", "xhs", "studio", "dy"]})
        assert [i["platform"] for i in resp.json()] == ["xhs", "dy"]  # 去重 + 去 studio


def test_batch_missing_product_404(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "batch4.db"
    with TestClient(app) as client:
        assert client.post("/api/batch/generate", json={"product_id": "nope", "brief": "x", "platforms": ["xhs"]}).status_code == 404

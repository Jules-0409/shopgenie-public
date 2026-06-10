"""平台强契约回归：校验失败自动矫正一次，仍失败则拦截成品。"""

import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.deepseek import DeepSeekClient
from app.main import app
from app.schemas import ChatRequest, Platform


def settings() -> Settings:
    return Settings(deepseek_api_key="test-key")


INVALID_XHS = json.dumps({
    "kind": "result",
    "message": "Generated listing",
    "title": "Premium Vitamin Gummies for Adults",
    "body": "Boost your immunity with our premium gummies. Made in USA. Best quality guaranteed for daily health.",
    "tags": [],
}, ensure_ascii=False)

VALID_XHS = json.dumps({
    "kind": "result",
    "message": "已生成种草笔记",
    "title": "每天两粒，嗓子真的舒服了",
    "body": "最近换季嗓子干痒，闺蜜推荐了这款维生素软糖，酸酸甜甜像吃糖一样，坚持两周明显感觉状态好了很多。成分表很干净，无蔗糖配方也不怕胖。",
    "tags": ["维生素软糖", "换季养生"],
}, ensure_ascii=False)


@pytest.mark.asyncio
async def test_contract_auto_corrects_once() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        content = INVALID_XHS if calls["n"] == 1 else VALID_XHS
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.deepseek.com") as client:
        response = await DeepSeekClient(settings(), client).chat(
            ChatRequest(platform=Platform.XHS, message="介绍一下这款产品")
        )

    assert calls["n"] == 2  # 原始请求 + 一次矫正
    assert response.result is not None
    assert response.result.tags  # 矫正后的合法成品
    assert any("自动矫正" in w for w in (response.warnings or []))


@pytest.mark.asyncio
async def test_contract_blocks_after_failed_correction() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json={"choices": [{"message": {"content": INVALID_XHS}}]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.deepseek.com") as client:
        response = await DeepSeekClient(settings(), client).chat(
            ChatRequest(platform=Platform.XHS, message="介绍一下这款产品")
        )

    assert calls["n"] == 2  # 只矫正一次，不无限重试
    assert response.result is None  # 错误成品被拦截，不展示
    assert "拦截" in response.message
    assert any(w.startswith("🚫") for w in (response.warnings or []))


def test_chat_rejects_studio_platform() -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(deepseek_api_key="test")
    try:
        with TestClient(app) as client:
            r1 = client.post("/api/chat", json={"platform": "studio", "message": "你好"})
            r2 = client.post("/api/chat/stream", json={"platform": "studio", "message": "你好"})
    finally:
        app.dependency_overrides.clear()
    assert r1.status_code == 422
    assert r2.status_code == 422

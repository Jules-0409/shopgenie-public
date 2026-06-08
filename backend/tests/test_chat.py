import httpx
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.prompts import build_system_prompt
from app.schemas import ChatRequest, Platform


def settings() -> Settings:
    return Settings(deepseek_api_key="test-key")


@pytest.mark.asyncio
async def test_chat_returns_content_and_usage() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer test-key"
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "可直接使用的脚本"}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.deepseek.com") as client:
        result = await DeepSeekClient(settings(), client).chat(ChatRequest(platform=Platform.DOUYIN, message="写个面膜脚本"))

    assert result.message == "可直接使用的脚本"
    assert result.usage.total_tokens == 30


@pytest.mark.asyncio
async def test_chat_rejects_empty_upstream_content() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": " "}}]}))
    async with httpx.AsyncClient(transport=transport, base_url="https://api.deepseek.com") as client:
        with pytest.raises(DeepSeekError, match="空内容"):
            await DeepSeekClient(settings(), client).chat(ChatRequest(platform=Platform.XHS, message="写笔记"))


@pytest.mark.asyncio
async def test_chat_reports_upstream_failure() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(429, json={"error": "rate limit"}))
    async with httpx.AsyncClient(transport=transport, base_url="https://api.deepseek.com") as client:
        with pytest.raises(DeepSeekError, match="请求失败"):
            await DeepSeekClient(settings(), client).chat(ChatRequest(platform=Platform.AMAZON, message="写 listing"))


def test_chat_rejects_empty_message() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(platform=Platform.DOUYIN, message="")


def test_chat_rejects_oversized_message() -> None:
    with pytest.raises(ValidationError):
        ChatRequest(platform=Platform.XHS, message="太" * 501)


def test_prompt_forbids_inventing_product_facts() -> None:
    prompt = build_system_prompt(Platform.DOUYIN)
    assert "只能使用用户消息中明确提供的产品事实" in prompt
    assert "不得从商品名称推断" in prompt
    assert "用户没有明确提供的肤感" in prompt
    assert "少于 3 项时禁止生成成品" in prompt

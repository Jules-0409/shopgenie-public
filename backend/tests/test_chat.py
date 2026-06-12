import httpx
import pytest
import json
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
                "choices": [{"message": {"content": json.dumps({
                    "kind": "result",
                    "message": "已生成脚本",
                    "title": "15秒补水面膜脚本",
                    "body": "完整脚本正文",
                    "tags": ["补水"],
                    "sections": [{"label": "0-3秒 Hook", "content": "开场口播"}],
                }, ensure_ascii=False)}}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
            },
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://api.deepseek.com") as client:
        result = await DeepSeekClient(settings(), client).chat(ChatRequest(platform=Platform.DOUYIN, message="写个面膜脚本"))

    assert result.message == "已生成脚本"
    assert result.result is not None
    assert result.result.sections[0].label == "0-3秒 Hook"
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
    assert "只能使用用户明确提供的产品事实" in prompt
    assert "不得凭空捏造" in prompt
    assert "待补充" in prompt
    assert '"kind":"draft"' in prompt
    assert '"kind":"result"' in prompt
    assert "与用户的对话沟通一律使用中文" in prompt
    assert "全部问题与回答" in prompt


def test_amazon_prompt_mandates_english_listing() -> None:
    prompt = build_system_prompt(Platform.AMAZON)
    assert "对话沟通使用中文" in prompt
    assert "英文" in prompt
    assert "英语消费者" in prompt


@pytest.mark.asyncio
async def test_chat_returns_question_without_result() -> None:
    content = json.dumps({"kind": "message", "message": "请补充产品材质"}, ensure_ascii=False)
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": content}}]}))
    async with httpx.AsyncClient(transport=transport, base_url="https://api.deepseek.com") as client:
        result = await DeepSeekClient(settings(), client).chat(ChatRequest(platform=Platform.XHS, message="写笔记"))
    assert result.message == "请补充产品材质"
    assert result.result is None


@pytest.mark.asyncio
async def test_chat_keeps_title_and_questions_from_markdown_wrapped_json() -> None:
    content = """```json
{"kind":"draft","conversation_title":"补水面膜种草","message":"先看草稿","title":"面膜草稿","body":"正文","questions":[{"question":"什么肤质？","options":["干皮","自定义填写"]}]}
```"""
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": content}}]}))
    async with httpx.AsyncClient(transport=transport, base_url="https://api.deepseek.com") as client:
        result = await DeepSeekClient(settings(), client).chat(ChatRequest(platform=Platform.XHS, message="写笔记"))

    assert result.conversation_title == "补水面膜种草"
    assert result.questions == [{"question": "什么肤质？", "options": ["干皮", "自定义填写"]}]


def test_incomplete_draft_keeps_follow_up_instead_of_raising() -> None:
    client = DeepSeekClient(settings())
    content = json.dumps({
        "kind": "draft",
        "message": "还需要确认防水等级",
        "questions": [{"question": "防水等级？", "options": ["IP67", "不防水"]}],
    }, ensure_ascii=False)

    message, result = client._parse_content(content, ChatRequest(platform=Platform.AMAZON, message="儿童手表"))

    assert message == "还需要确认防水等级"
    assert result is None
    assert client._parse_questions(content) == [{"question": "防水等级？", "options": ["IP67", "不防水"]}]

import logging
import json
from typing import Any

import httpx

from app.config import Settings
from app.prompts import build_system_prompt
from app.schemas import ChatRequest, ChatResponse, ContentSection, GeneratedContent, Usage

logger = logging.getLogger(__name__)


class DeepSeekError(RuntimeError):
    """Raised when DeepSeek cannot produce a usable response."""


class DeepSeekClient:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self.settings = settings
        self._client = client

    async def chat(self, request: ChatRequest) -> ChatResponse:
        payload = {
            "model": self.settings.deepseek_model,
            "thinking": {"type": "disabled"},
            "response_format": {"type": "json_object"},
            "max_tokens": 1200,
            "messages": [
                {"role": "system", "content": build_system_prompt(request.platform)},
                *[message.model_dump() for message in request.history],
                {"role": "user", "content": request.message},
            ],
        }
        response_data = await self._post(payload)
        try:
            content = response_data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, AttributeError) as exc:
            raise DeepSeekError("DeepSeek 返回了无法解析的响应") from exc
        if not content:
            raise DeepSeekError("DeepSeek 返回了空内容")
        message, result = self._parse_content(content, request)

        usage_data = response_data.get("usage", {})
        usage = Usage(
            prompt_tokens=usage_data.get("prompt_tokens", 0),
            completion_tokens=usage_data.get("completion_tokens", 0),
            total_tokens=usage_data.get("total_tokens", 0),
        )
        logger.info("DeepSeek usage model=%s total_tokens=%s", self.settings.deepseek_model, usage.total_tokens)
        return ChatResponse(message=message, result=result, model=self.settings.deepseek_model, usage=usage)

    def _parse_content(self, content: str, request: ChatRequest) -> tuple[str, GeneratedContent | None]:
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise DeepSeekError("DeepSeek 返回了无法解析的结构化内容") from exc
        if parsed.get("kind") == "message":
            message = str(parsed.get("message", "")).strip()
            if not message:
                raise DeepSeekError("DeepSeek 返回了空追问")
            return message, None
        if parsed.get("kind") != "result":
            raise DeepSeekError("DeepSeek 返回了未知内容类型")
        try:
            result = GeneratedContent(
                platform=request.platform,
                title=parsed["title"],
                body=parsed["body"],
                tags=parsed.get("tags", []),
                sections=[ContentSection.model_validate(section) for section in parsed.get("sections", [])],
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise DeepSeekError("DeepSeek 返回的成品结构不完整") from exc
        return str(parsed.get("message", "已生成可直接使用的内容。")).strip(), result

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.settings.deepseek_api_key}"}
        if self._client is not None:
            return await self._request(self._client, payload, headers)
        async with httpx.AsyncClient(
            base_url=self.settings.deepseek_base_url,
            timeout=self.settings.deepseek_timeout_seconds,
        ) as client:
            return await self._request(client, payload, headers)

    async def _request(
        self,
        client: httpx.AsyncClient,
        payload: dict[str, Any],
        headers: dict[str, str],
    ) -> dict[str, Any]:
        try:
            response = await client.post("/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException as exc:
            raise DeepSeekError("DeepSeek 请求超时，请稍后重试") from exc
        except httpx.HTTPStatusError as exc:
            logger.error("DeepSeek HTTP error status=%s", exc.response.status_code)
            raise DeepSeekError("DeepSeek 服务请求失败，请稍后重试") from exc
        except (httpx.HTTPError, ValueError) as exc:
            raise DeepSeekError("无法连接 DeepSeek 服务") from exc

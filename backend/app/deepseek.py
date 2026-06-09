import logging
import json
from typing import Any

import httpx

from app.config import Settings
from app.memory import UserProfile, build_memory_prompt
from app.postprocess import post_process
from app.platform_validator import validate_platform_content
from app.prompts import build_system_prompt
from app.schemas import ChatRequest, ChatResponse, ContentSection, GeneratedContent, Usage
from app.workspace import Product
from app.workspace_context import build_knowledge_prompt, build_performance_prompt, build_product_prompt, build_content_history_prompt, retrieve_knowledge
from app.competitive_analysis import search_competitors, build_competitive_context

logger = logging.getLogger(__name__)


class DeepSeekError(RuntimeError):
    """Raised when DeepSeek cannot produce a usable response."""


class DeepSeekClient:
    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
        profile: UserProfile | None = None,
        product: Product | None = None,
    ) -> None:
        self.settings = settings
        self._client = client
        self._profile = profile
        self._product = product

    async def chat(self, request: ChatRequest) -> ChatResponse:
        system_prompt = build_system_prompt(request.platform)
        memory_prompt = build_memory_prompt(self._profile)
        if memory_prompt:
            system_prompt = f"{system_prompt}\n\n{memory_prompt}"
        product_prompt = build_product_prompt(self._product)
        if product_prompt:
            system_prompt = f"{system_prompt}\n\n{product_prompt}"
        knowledge_prompt = build_knowledge_prompt(request.platform, request.message)
        if knowledge_prompt:
            system_prompt = f"{system_prompt}\n\n{knowledge_prompt}"
        performance_prompt = build_performance_prompt(request.product_id, request.platform)
        if performance_prompt:
            system_prompt = f"{system_prompt}\n\n{performance_prompt}"
        content_history_prompt = build_content_history_prompt(request.product_id, request.platform)
        if content_history_prompt:
            system_prompt = f"{system_prompt}\n\n{content_history_prompt}"
        # Competitive analysis: search for similar content patterns
        category = self._product.category if self._product else self._extract_category(request.message)
        if category:
            try:
                competitors = await search_competitors(category, request.platform)
                competitive_context = build_competitive_context(category, request.platform, competitors)
                if competitive_context:
                    system_prompt = f"{system_prompt}\n\n{competitive_context}"
            except Exception as exc:
                logger.warning("Competitive analysis failed: %s", exc)
        payload = {
            "model": self.settings.deepseek_model,
            "thinking": {"type": "disabled"},
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
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
        conversation_title = self._parse_title(content)
        questions = self._parse_questions(content)
        warnings = None
        if result is not None:
            pp = post_process(result, self._profile.taboo_words if self._profile else None)
            if pp.warnings:
                warnings = pp.warnings
            # Platform structure validation
            validation = validate_platform_content(result)
            if not validation.valid:
                platform_warnings = [f"🚫 平台结构校验：{err}" for err in validation.errors]
                warnings = (warnings or []) + platform_warnings
                logger.warning("Platform validation failed for %s: %s", request.platform.value, validation.errors)
        sources = [
            {"id": source.id, "title": source.title, "url": source.url}
            for source in retrieve_knowledge(request.platform, request.message)
        ]
        return ChatResponse(message=message, result=result, questions=questions, warnings=warnings, conversation_title=conversation_title, model=self.settings.deepseek_model, usage=usage, sources=sources)

    def _parse_content(self, content: str, request: ChatRequest) -> tuple[str, GeneratedContent | None]:
        parsed = self._try_parse_json(content)
        if parsed is None:
            raise DeepSeekError("DeepSeek 返回了无法解析的结构化内容")
        if parsed.get("kind") == "chat":
            message = str(parsed.get("message", "")).strip()
            if not message:
                raise DeepSeekError("DeepSeek 返回了空回复")
            return message, None
        if parsed.get("kind") == "message":
            message = str(parsed.get("message", "")).strip()
            if not message:
                raise DeepSeekError("DeepSeek 返回了空追问")
            return message, None
        if parsed.get("kind") in ("result", "draft"):
            try:
                result = GeneratedContent(
                    platform=request.platform,
                    title=parsed["title"],
                    body=parsed["body"],
                    tags=parsed.get("tags", []),
                    sections=[ContentSection.model_validate(section) for section in parsed.get("sections", [])],
                )
            except (KeyError, TypeError, ValueError) as exc:
                logger.error("DeepSeek 返回结构不完整: %s | parsed keys: %s", exc, list(parsed.keys()))
                raise DeepSeekError("DeepSeek 返回的成品结构不完整") from exc
            return str(parsed.get("message", "已生成可直接使用的内容。")).strip(), result
        raise DeepSeekError("DeepSeek 返回了未知内容类型")

    @staticmethod
    def _try_parse_json(content: str) -> dict | None:
        """Try to parse JSON, stripping markdown code blocks and fixing common issues."""
        text = content.strip()
        # Strip markdown code block wrapping
        if text.startswith("```"):
            first_newline = text.find("\n")
            if first_newline != -1:
                text = text[first_newline + 1:]
            if text.endswith("```"):
                text = text[:-3].rstrip()
        # Direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try to find JSON object in the text
        start = text.find("{")
        if start != -1:
            # Try progressively shorter substrings (handles truncated JSON)
            for end in range(len(text), start, -1):
                if text[end - 1] == "}":
                    try:
                        return json.loads(text[start:end])
                    except json.JSONDecodeError:
                        continue
            # Last resort: try the text from first { onwards
            try:
                return json.loads(text[start:])
            except json.JSONDecodeError:
                pass
        return None

    def _parse_title(self, content: str) -> str | None:
        parsed = self._try_parse_json(content)
        if parsed is not None:
            title = parsed.get("conversation_title")
            if title and isinstance(title, str) and title.strip():
                return title.strip()[:30]
        return None

    def _parse_questions(self, content: str) -> list[dict[str, Any]] | None:
        parsed = self._try_parse_json(content)
        if parsed is not None:
            questions = parsed.get("questions")
            if isinstance(questions, list) and len(questions) > 0:
                return questions[:5]
        return None

    @staticmethod
    def _extract_category(message: str) -> str | None:
        """Extract product category from user message using simple heuristics."""
        # Common category keywords
        categories = [
            "面膜", "护肤品", "化妆品", "口红", "精华", "防晒", "洗面奶",
            "卫生巾", "内衣", "衣服", "鞋", "包", "手表", "首饰",
            "食品", "零食", "饮料", "咖啡", "茶",
            "手机", "耳机", "充电器", "数据线", "键盘", "鼠标",
            "保温杯", "水杯", "厨具", "家居", "收纳",
            "母婴", "玩具", "文具", "宠物",
            "skincare", "makeup", "electronics", "food", "fashion",
        ]
        for cat in categories:
            if cat in message.lower():
                return cat
        # Fallback: try to extract product name from message
        # Look for patterns like "产品是XXX" or "写个XXX的"
        import re
        match = re.search(r"(?:产品是|写个?|做一个?|帮我写)(.{2,8}?)(?:的|笔记|脚本|文案|listing)", message)
        if match:
            return match.group(1).strip()
        return None

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.settings.deepseek_api_key}"}
        if self._client is not None:
            return await self._request(self._client, payload, headers)
        async with httpx.AsyncClient(
            base_url=self.settings.deepseek_base_url,
            timeout=self.settings.deepseek_timeout_seconds,
        ) as client:
            return await self._request(client, payload, headers)

    async def chat_stream(self, request: ChatRequest):
        """Stream tokens from DeepSeek API. Yields string tokens."""
        system_prompt = build_system_prompt(request.platform)
        memory_prompt = build_memory_prompt(self._profile)
        if memory_prompt:
            system_prompt = f"{system_prompt}\n\n{memory_prompt}"
        product_prompt = build_product_prompt(self._product)
        if product_prompt:
            system_prompt = f"{system_prompt}\n\n{product_prompt}"
        knowledge_prompt = build_knowledge_prompt(request.platform, request.message)
        if knowledge_prompt:
            system_prompt = f"{system_prompt}\n\n{knowledge_prompt}"
        performance_prompt = build_performance_prompt(request.product_id, request.platform)
        if performance_prompt:
            system_prompt = f"{system_prompt}\n\n{performance_prompt}"
        content_history_prompt = build_content_history_prompt(request.product_id, request.platform)
        if content_history_prompt:
            system_prompt = f"{system_prompt}\n\n{content_history_prompt}"
        # Competitive analysis
        category = self._product.category if self._product else self._extract_category(request.message)
        if category:
            try:
                competitors = await search_competitors(category, request.platform)
                competitive_context = build_competitive_context(category, request.platform, competitors)
                if competitive_context:
                    system_prompt = f"{system_prompt}\n\n{competitive_context}"
            except Exception as exc:
                logger.warning("Competitive analysis failed: %s", exc)

        payload = {
            "model": self.settings.deepseek_model,
            "thinking": {"type": "disabled"},
            "response_format": {"type": "json_object"},
            "stream": True,
            "messages": [
                {"role": "system", "content": system_prompt},
                *[message.model_dump() for message in request.history],
                {"role": "user", "content": request.message},
            ],
        }
        headers = {"Authorization": f"Bearer {self.settings.deepseek_api_key}"}
        async with httpx.AsyncClient(
            base_url=self.settings.deepseek_base_url,
            timeout=self.settings.deepseek_timeout_seconds,
        ) as client:
            async with client.stream("POST", "/chat/completions", json=payload, headers=headers) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        token = delta.get("content", "")
                        if token:
                            yield token
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue

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

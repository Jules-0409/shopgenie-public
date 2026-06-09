"""SSE 流式聊天端点：状态事件 + 最终结果"""
import json
import logging
from collections.abc import AsyncGenerator

from fastapi import Depends
from starlette.responses import StreamingResponse

from app.config import Settings, get_settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.memory import get_profile
from app.postprocess import post_process
from app.schemas import ChatRequest, Platform
from app.workspace import get_product
from app.workspace_context import learn_product_from_message

logger = logging.getLogger(__name__)


def sse_event(event: str, data: dict | str) -> str:
    """Format a server-sent event."""
    payload = json.dumps(data, ensure_ascii=False) if isinstance(data, dict) else data
    return f"event: {event}\ndata: {payload}\n\n"


async def chat_stream_generator(
    request: ChatRequest,
    settings: Settings,
) -> AsyncGenerator[str, None]:
    """Generate SSE events for a chat request."""
    from starlette.concurrency import run_in_threadpool

    try:
        # Step 1: Loading context
        yield sse_event("status", {"step": "loading", "message": "正在加载上下文..."})

        profile = await run_in_threadpool(get_profile)
        product = await run_in_threadpool(get_product, request.product_id) if request.product_id else None
        if product:
            product = await run_in_threadpool(learn_product_from_message, product, request.message)

        # Step 2: Knowledge discovery (if needed)
        from app.web_search import needs_web_discovery
        if needs_web_discovery(request.message):
            yield sse_event("status", {"step": "discovering", "message": "正在发现相关知识..."})
            try:
                from app.web_search import discover_knowledge
                import httpx
                await discover_knowledge(request.message, request.platform)
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Knowledge discovery failed: %s", exc)

        # Step 3: Generating
        yield sse_event("status", {"step": "generating", "message": "正在生成内容..."})

        # Step 4: Stream tokens from DeepSeek
        yield sse_event("status", {"step": "streaming", "message": "模型输出中..."})

        client = DeepSeekClient(settings, profile=profile, product=product)
        full_content = ""
        async for token in client.chat_stream(request):
            full_content += token
            yield sse_event("token", {"text": token})

        # Step 5: Parse result
        yield sse_event("status", {"step": "parsing", "message": "正在解析结果..."})

        message, result = client._parse_content(full_content, request)
        questions = client._parse_questions(full_content)
        conversation_title = client._parse_title(full_content)

        # Step 6: Post-processing
        warnings = None
        if result is not None:
            yield sse_event("status", {"step": "postprocessing", "message": "正在质检..."})
            pp = post_process(result)
            if pp.warnings:
                warnings = pp.warnings

        # Step 7: Save to workspace
        from app.workspace import create_agent_task, complete_agent_task, create_content_asset
        task = await run_in_threadpool(create_agent_task, request.message)
        asset_id = None
        quality = None
        if result is not None:
            asset, version = await run_in_threadpool(
                create_content_asset, result, request.product_id, warnings,
            )
            asset_id = asset.id
            quality = version.quality
            await run_in_threadpool(complete_agent_task, task, f"已生成内容并保存为 {asset.name}")
        else:
            await run_in_threadpool(complete_agent_task, task, message[:200])

        # Step 8: Final result
        response_data = {
            "message": message,
            "result": result.model_dump() if result else None,
            "questions": questions,
            "warnings": warnings,
            "conversation_title": conversation_title,
            "asset_id": asset_id,
            "quality": quality.model_dump() if quality else None,
            "task_id": task.id,
            "sources": [],
        }
        yield sse_event("result", response_data)
        yield sse_event("done", {"status": "ok"})

    except DeepSeekError as exc:
        yield sse_event("error", {"message": str(exc)})
        yield sse_event("done", {"status": "error"})
    except Exception as exc:
        logger.exception("Stream error")
        yield sse_event("error", {"message": "生成过程中出现未知错误"})
        yield sse_event("done", {"status": "error"})

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
        if request.product_id and not product:
            yield sse_event("error", {"message": "当前会话绑定的商品不存在，请重新选择商品后新建会话"})
            yield sse_event("done", {"status": "error"})
            return
        if product:
            product = await run_in_threadpool(learn_product_from_message, product, request.message)

        # Step 2: Image analysis (if provided)
        image_context = ""
        if request.image_url:
            yield sse_event("status", {"step": "analyzing", "message": "正在分析图片..."})
            try:
                from app.vision import analyze_image
                image_analysis = await analyze_image(
                    request.image_url,
                    "请详细描述这张商品图片的内容，包括颜色、材质、形状、场景、文字等所有可见特征，并提取可能的卖点。",
                    settings,
                )
                image_context = f"\n\n【用户上传的图片分析】\n{image_analysis}\n请基于以上图片信息辅助生成内容。"
            except Exception as exc:
                logger.warning("Image analysis failed: %s", exc)
                image_context = "\n\n【图片分析失败】用户上传了图片但分析失败，请基于文字描述生成。"

        # Step 3: Knowledge discovery (if needed)
        from app.web_search import needs_web_discovery
        if needs_web_discovery(request.message):
            yield sse_event("status", {"step": "discovering", "message": "正在发现相关知识..."})
            try:
                from app.web_search import discover_knowledge
                import httpx
                await discover_knowledge(request.message, request.platform)
            except (httpx.HTTPError, ValueError) as exc:
                logger.warning("Knowledge discovery failed: %s", exc)

        # Step 7: Generate
        yield sse_event("status", {"step": "generating", "message": "正在生成内容..."})
        yield sse_event("status", {"step": "streaming", "message": "模型输出中..."})

        client = DeepSeekClient(settings, profile=profile, product=product)
        full_content = ""
        async for token in client.chat_stream(request, extra_context=image_context):
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
            # 平台强契约：校验失败自动矫正一次，仍失败则拦截（result 置 None，不展示不保存）
            message, result, contract_warnings = await client.enforce_platform_contract(
                request, message, result, full_content,
            )
            if result is not None:
                pp = post_process(result, profile.taboo_words if profile else None)
                if pp.warnings:
                    warnings = pp.warnings
            if contract_warnings:
                warnings = (warnings or []) + contract_warnings

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
        from app.workspace_context import retrieve_knowledge
        sources = [
            {"id": source.id, "title": source.title, "url": source.url}
            for source in retrieve_knowledge(request.platform, request.message)
        ]
        response_data = {
            "message": message,
            "result": result.model_dump() if result else None,
            "questions": questions,
            "warnings": warnings,
            "conversation_title": conversation_title,
            "asset_id": asset_id,
            "quality": quality if quality else None,
            "task_id": task.id,
            "sources": sources,
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

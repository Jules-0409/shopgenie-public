import asyncio
import json
import logging
import uuid
from pathlib import Path
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.responses import StreamingResponse

from app.config import Settings, get_settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.stream import chat_stream_generator
from app.memory import UserProfile, get_profile, save_profile, delete_profile
from app.sessions import StoredSession, list_sessions, get_session, save_session, delete_session
from app.knowledge_fetch import fetch_public_page
from app.web_search import discover_knowledge, needs_web_discovery
from app.schemas import ChatRequest, ChatResponse, GeneratedContent, Platform
from app.workspace import (
    AgentTask,
    ContentAsset,
    ContentVersion,
    Experiment,
    KnowledgeSource,
    PerformanceRecord,
    Product,
    add_content_version,
    compute_winner,
    delete_experiment,
    get_experiment,
    list_experiments,
    save_experiment,
    complete_agent_task,
    create_agent_task,
    create_content_asset,
    delete_product,
    delete_content_asset,
    get_product,
    get_current_version,
    fail_agent_task,
    list_agent_tasks,
    list_content_assets,
    list_content_versions,
    list_knowledge_sources,
    list_performance,
    list_products,
    save_knowledge_source,
    save_performance,
    save_product,
    build_performance_insights,
)
from app.workspace_context import learn_product_from_message
from app.review_mining import analyze_reviews
from app.ab_testing import generate_variants

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


def _ensure_chat_platform(request: ChatRequest) -> None:
    """Studio 等非聊天平台不进生成链路，避免 PLATFORM_PROMPTS KeyError。"""
    from app.prompts import PLATFORM_PROMPTS
    if request.platform not in PLATFORM_PROMPTS:
        raise HTTPException(status_code=422, detail=f"平台 {request.platform.value} 不支持聊天生成")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, settings: Settings = Depends(get_settings)) -> ChatResponse:
    _ensure_chat_platform(request)
    task: AgentTask | None = None
    try:
        profile = await run_in_threadpool(get_profile)
        product = await run_in_threadpool(get_product, request.product_id) if request.product_id else None
        if product:
            product = await run_in_threadpool(learn_product_from_message, product, request.message)
        task = await run_in_threadpool(create_agent_task, request.message)
        if needs_web_discovery(request.message):
            try:
                await discover_knowledge(request.message, request.platform)
            except (httpx.HTTPError, ValueError) as exc:
                logging.getLogger(__name__).warning("Knowledge discovery failed: %s", exc)
        response = await DeepSeekClient(settings, profile=profile, product=product).chat(request)
        response.task_id = task.id
        if response.result is not None:
            asset, version = await run_in_threadpool(
                create_content_asset,
                response.result,
                request.product_id,
                response.warnings,
            )
            response.asset_id = asset.id
            response.quality = version.quality
            await run_in_threadpool(complete_agent_task, task, f"已生成内容并保存为 {asset.name}")
        else:
            await run_in_threadpool(complete_agent_task, task, response.message[:200])
        return response
    except DeepSeekError as exc:
        if task:
            await run_in_threadpool(fail_agent_task, task, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest, settings: Settings = Depends(get_settings)) -> StreamingResponse:
    _ensure_chat_platform(request)
    return StreamingResponse(
        chat_stream_generator(request, settings),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class ProfileResponse(BaseModel):
    profile: UserProfile | None
    exists: bool


ShortProfileText = Annotated[str, Field(max_length=200)]


class ProfileUpdateRequest(BaseModel):
    brand_name: ShortProfileText = ""
    category: ShortProfileText = ""
    target_audience: ShortProfileText = ""
    tone: ShortProfileText = ""
    style_preferences: list[ShortProfileText] = Field(default_factory=list, max_length=20)
    platforms: list[Platform] = Field(default_factory=list, max_length=3)
    taboo_words: list[ShortProfileText] = Field(default_factory=list, max_length=50)
    extra_notes: str = Field(default="", max_length=1000)


@app.get("/api/profile", response_model=ProfileResponse)
async def api_get_profile() -> ProfileResponse:
    profile = await run_in_threadpool(get_profile)
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
        platforms=[platform.value for platform in req.platforms],
        taboo_words=req.taboo_words,
        extra_notes=req.extra_notes,
    )
    await run_in_threadpool(save_profile, profile)
    return ProfileResponse(profile=profile, exists=True)


@app.delete("/api/profile")
async def api_delete_profile() -> dict[str, bool]:
    deleted = await run_in_threadpool(delete_profile)
    return {"deleted": deleted}


class ProductInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(default="", max_length=200)
    audience: str = Field(default="", max_length=300)
    selling_points: list[ShortProfileText] = Field(default_factory=list, max_length=20)
    facts: list[ShortProfileText] = Field(default_factory=list, max_length=50)
    prohibited_claims: list[ShortProfileText] = Field(default_factory=list, max_length=50)
    notes: str = Field(default="", max_length=2000)


@app.get("/api/products", response_model=list[Product])
async def api_list_products() -> list[Product]:
    return await run_in_threadpool(list_products)


@app.post("/api/products", response_model=Product)
async def api_create_product(req: ProductInput) -> Product:
    return await run_in_threadpool(save_product, Product(**req.model_dump()))


@app.put("/api/products/{product_id}", response_model=Product)
async def api_update_product(product_id: str, req: ProductInput) -> Product:
    product = await run_in_threadpool(get_product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    for key, value in req.model_dump().items():
        setattr(product, key, value)
    return await run_in_threadpool(save_product, product)


@app.delete("/api/products/{product_id}")
async def api_delete_product(product_id: str) -> dict[str, bool]:
    return {"deleted": await run_in_threadpool(delete_product, product_id)}


class ReviewAnalyzeInput(BaseModel):
    reviews: str = Field(min_length=1, max_length=20_000)


@app.post("/api/products/{product_id}/reviews/analyze", response_model=Product)
async def api_analyze_reviews(
    product_id: str, req: ReviewAnalyzeInput, settings: Settings = Depends(get_settings)
) -> Product:
    """评论反哺：分析买家评价，提炼洞察并存进商品事实库。"""
    product = await run_in_threadpool(get_product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    try:
        insights = await analyze_reviews(req.reviews, settings, product=product)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DeepSeekError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    product.review_insights = insights
    return await run_in_threadpool(save_product, product)


@app.delete("/api/products/{product_id}/reviews", response_model=Product)
async def api_clear_reviews(product_id: str) -> Product:
    """清除某商品的评论洞察。"""
    product = await run_in_threadpool(get_product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    product.review_insights = None
    return await run_in_threadpool(save_product, product)


# ── A/B 实验：变体生成 → 效果录入 → 赢家反哺 ──

class ExperimentGenerateInput(BaseModel):
    product_id: str | None = None
    platform: Platform = Platform.XHS
    brief: str = Field(default="", max_length=2000)
    n: int = Field(default=3, ge=2, le=5)


class VariantMetricsInput(BaseModel):
    label: str = Field(min_length=1, max_length=4)
    impressions: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)
    conversions: int = Field(default=0, ge=0)


@app.get("/api/experiments", response_model=list[Experiment])
async def api_list_experiments(product_id: str | None = None) -> list[Experiment]:
    return await run_in_threadpool(list_experiments, product_id)


@app.post("/api/experiments/generate", response_model=Experiment)
async def api_generate_experiment(req: ExperimentGenerateInput, settings: Settings = Depends(get_settings)) -> Experiment:
    if req.platform == Platform.STUDIO:
        raise HTTPException(status_code=422, detail="商品图工作室不支持 A/B 实验")
    product = await run_in_threadpool(get_product, req.product_id) if req.product_id else None
    if req.product_id and not product:
        raise HTTPException(status_code=404, detail="商品不存在")
    try:
        variants = await generate_variants(product, req.platform.value, req.brief, settings, req.n)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DeepSeekError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    name = (product.name if product else req.brief[:20]) or "未命名实验"
    experiment = Experiment(product_id=req.product_id, platform=req.platform.value, name=name, brief=req.brief, variants=variants)
    return await run_in_threadpool(save_experiment, experiment)


@app.post("/api/experiments/{experiment_id}/metrics", response_model=Experiment)
async def api_record_variant_metrics(experiment_id: str, req: VariantMetricsInput) -> Experiment:
    experiment = await run_in_threadpool(get_experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="实验不存在")
    variant = next((v for v in experiment.variants if v.get("label") == req.label), None)
    if not variant:
        raise HTTPException(status_code=404, detail="变体不存在")
    variant["impressions"] = req.impressions
    variant["clicks"] = req.clicks
    variant["conversions"] = req.conversions
    compute_winner(experiment)
    return await run_in_threadpool(save_experiment, experiment)


@app.delete("/api/experiments/{experiment_id}")
async def api_delete_experiment(experiment_id: str) -> dict[str, bool]:
    return {"deleted": await run_in_threadpool(delete_experiment, experiment_id)}


# ── 批量生成：一个商品一键产出多平台内容 ──

class BatchGenerateInput(BaseModel):
    product_id: str | None = None
    brief: str = Field(min_length=1, max_length=500)
    platforms: list[Platform] = Field(min_length=1, max_length=5)


class BatchResultItem(BaseModel):
    platform: str
    message: str | None = None
    result: GeneratedContent | None = None
    asset_id: str | None = None
    quality: dict | None = None
    warnings: list[str] | None = None
    error: str | None = None


@app.post("/api/batch/generate", response_model=list[BatchResultItem])
async def api_batch_generate(req: BatchGenerateInput, settings: Settings = Depends(get_settings)) -> list[BatchResultItem]:
    """一个商品/描述并行产出多个平台的内容，各自保存为内容资产。"""
    platforms = [p for p in dict.fromkeys(req.platforms) if p != Platform.STUDIO]
    if not platforms:
        raise HTTPException(status_code=422, detail="请选择至少一个内容平台（不含商品图工作室）")
    profile = await run_in_threadpool(get_profile)
    product = await run_in_threadpool(get_product, req.product_id) if req.product_id else None
    if req.product_id and not product:
        raise HTTPException(status_code=404, detail="商品不存在")

    async def gen_one(platform: Platform) -> BatchResultItem:
        try:
            request = ChatRequest(platform=platform, message=req.brief, history=[], product_id=req.product_id)
            response = await DeepSeekClient(settings, profile=profile, product=product).chat(request)
            asset_id = None
            quality = None
            if response.result is not None:
                asset, version = await run_in_threadpool(create_content_asset, response.result, req.product_id, response.warnings)
                asset_id = asset.id
                quality = version.quality
            return BatchResultItem(platform=platform.value, message=response.message, result=response.result, asset_id=asset_id, quality=quality, warnings=response.warnings)
        except DeepSeekError as exc:
            return BatchResultItem(platform=platform.value, error=str(exc))

    return list(await asyncio.gather(*[gen_one(p) for p in platforms]))


@app.get("/api/content", response_model=list[ContentAsset])
async def api_list_content() -> list[ContentAsset]:
    return await run_in_threadpool(list_content_assets)


@app.get("/api/content/{asset_id}/versions", response_model=list[ContentVersion])
async def api_list_versions(asset_id: str) -> list[ContentVersion]:
    return await run_in_threadpool(list_content_versions, asset_id)


@app.delete("/api/content/{asset_id}")
async def api_delete_content(asset_id: str) -> dict[str, bool]:
    return {"deleted": await run_in_threadpool(delete_content_asset, asset_id)}


class ContentVersionInput(BaseModel):
    content: GeneratedContent
    change_note: str = Field(default="手动编辑", max_length=300)


@app.post("/api/content/{asset_id}/versions", response_model=ContentVersion)
async def api_add_version(asset_id: str, req: ContentVersionInput) -> ContentVersion:
    try:
        return await run_in_threadpool(add_content_version, asset_id, req.content, req.change_note)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


class ReviseContentInput(BaseModel):
    instruction: str = Field(min_length=1, max_length=500)


@app.post("/api/content/{asset_id}/revise", response_model=ContentVersion)
async def api_revise_content(
    asset_id: str,
    req: ReviseContentInput,
    settings: Settings = Depends(get_settings),
) -> ContentVersion:
    asset = await run_in_threadpool(lambda: next((item for item in list_content_assets() if item.id == asset_id), None))
    current = await run_in_threadpool(get_current_version, asset_id)
    if not asset or not current:
        raise HTTPException(status_code=404, detail="内容资产不存在")
    profile = await run_in_threadpool(get_profile)
    product = await run_in_threadpool(get_product, asset.product_id) if asset.product_id else None
    original = GeneratedContent.model_validate(current.content)
    history_text = original.model_dump_json()[:4000]
    request = ChatRequest(
        platform=Platform(asset.platform),
        message=f"请按要求修改上一版内容：{req.instruction}",
        history=[{"role": "assistant", "content": history_text}],
        product_id=asset.product_id,
    )
    response = await DeepSeekClient(settings, profile=profile, product=product).chat(request)
    if response.result is None:
        raise HTTPException(status_code=502, detail="模型没有返回可保存的修改版本")
    return await run_in_threadpool(add_content_version, asset_id, response.result, f"AI 修改：{req.instruction}")


class KnowledgeSourceInput(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source_type: str = Field(default="platform_rule", max_length=80)
    platform: Platform | None = None
    content: str = Field(min_length=1, max_length=10000)
    url: str = Field(default="", max_length=1000)


class KnowledgeImportInput(BaseModel):
    url: str = Field(min_length=1, max_length=1000)
    platform: Platform | None = None
    source_type: str = Field(default="web_reference", max_length=80)


class KnowledgeDiscoverInput(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    platform: Platform


@app.get("/api/knowledge", response_model=list[KnowledgeSource])
async def api_list_knowledge() -> list[KnowledgeSource]:
    return await run_in_threadpool(list_knowledge_sources)


@app.post("/api/knowledge", response_model=KnowledgeSource)
async def api_create_knowledge(req: KnowledgeSourceInput) -> KnowledgeSource:
    data = req.model_dump()
    data["platform"] = req.platform.value if req.platform else None
    return await run_in_threadpool(save_knowledge_source, KnowledgeSource(**data))


@app.post("/api/knowledge/import", response_model=KnowledgeSource)
async def api_import_knowledge(req: KnowledgeImportInput) -> KnowledgeSource:
    try:
        title, content = await fetch_public_page(req.url)
    except (ValueError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    source = KnowledgeSource(
        title=title,
        source_type=req.source_type,
        platform=req.platform.value if req.platform else None,
        content=content,
        url=req.url,
    )
    return await run_in_threadpool(save_knowledge_source, source)


@app.post("/api/knowledge/discover", response_model=list[KnowledgeSource])
async def api_discover_knowledge(req: KnowledgeDiscoverInput) -> list[KnowledgeSource]:
    try:
        return await discover_knowledge(req.query, req.platform)
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=f"公开网页检索失败：{exc}") from exc


@app.get("/api/tasks", response_model=list[AgentTask])
async def api_list_tasks() -> list[AgentTask]:
    return await run_in_threadpool(list_agent_tasks)


class AgentRunInput(BaseModel):
    objective: str = Field(min_length=1, max_length=500)
    asset_id: str = Field(min_length=1, max_length=80)


class AgentRunResponse(BaseModel):
    task: AgentTask
    version: ContentVersion


@app.post("/api/tasks/run", response_model=AgentRunResponse)
async def api_run_task(req: AgentRunInput, settings: Settings = Depends(get_settings)) -> AgentRunResponse:
    task = await run_in_threadpool(create_agent_task, req.objective)
    asset = await run_in_threadpool(lambda: next((item for item in list_content_assets() if item.id == req.asset_id), None))
    current = await run_in_threadpool(get_current_version, req.asset_id)
    if not asset or not current:
        await run_in_threadpool(fail_agent_task, task, "内容资产不存在")
        raise HTTPException(status_code=404, detail="内容资产不存在")
    profile = await run_in_threadpool(get_profile)
    product = await run_in_threadpool(get_product, asset.product_id) if asset.product_id else None
    original = GeneratedContent.model_validate(current.content)
    request = ChatRequest(
        platform=Platform(asset.platform),
        message=f"执行内容优化任务：{req.objective}。必须返回修改后的完整成品。",
        history=[{"role": "assistant", "content": original.model_dump_json()[:4000]}],
        product_id=asset.product_id,
    )
    try:
        response = await DeepSeekClient(settings, profile=profile, product=product).chat(request)
        if response.result is None:
            raise DeepSeekError("Agent 没有返回可保存的成品")
        version = await run_in_threadpool(add_content_version, asset.id, response.result, f"Agent 任务：{req.objective}")
        await run_in_threadpool(complete_agent_task, task, f"已创建 v{version.version}，质量分 {version.quality['score']}")
        return AgentRunResponse(task=task, version=version)
    except DeepSeekError as exc:
        await run_in_threadpool(fail_agent_task, task, str(exc))
        raise HTTPException(status_code=502, detail=str(exc)) from exc


class PerformanceInput(BaseModel):
    asset_id: str = Field(min_length=1, max_length=80)
    platform: Platform
    impressions: int = Field(default=0, ge=0)
    engagements: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)
    conversions: int = Field(default=0, ge=0)
    revenue: float = Field(default=0, ge=0)
    notes: str = Field(default="", max_length=1000)


@app.get("/api/performance", response_model=list[PerformanceRecord])
async def api_list_performance() -> list[PerformanceRecord]:
    return await run_in_threadpool(list_performance)


@app.get("/api/performance/insights")
async def api_performance_insights() -> dict[str, int | float | str]:
    return await run_in_threadpool(build_performance_insights)


@app.post("/api/performance", response_model=PerformanceRecord)
async def api_create_performance(req: PerformanceInput) -> PerformanceRecord:
    data = req.model_dump()
    data["platform"] = req.platform.value
    return await run_in_threadpool(save_performance, PerformanceRecord(**data))


# --- Sessions ---

class SessionInput(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    platform: Platform
    title: str = Field(default="", max_length=200)
    product_id: str | None = None
    messages: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    studio: dict[str, Any] | None = None


@app.get("/api/sessions", response_model=list[StoredSession])
async def api_list_sessions() -> list[StoredSession]:
    return await run_in_threadpool(list_sessions)


@app.get("/api/sessions/{session_id}", response_model=StoredSession)
async def api_get_session(session_id: str) -> StoredSession:
    session = await run_in_threadpool(get_session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session


@app.post("/api/sessions", response_model=StoredSession)
async def api_save_session(req: SessionInput) -> StoredSession:
    session = StoredSession(
        id=req.id, platform=req.platform.value, title=req.title,
        product_id=req.product_id, messages=req.messages,
        studio=req.studio,
    )
    await run_in_threadpool(save_session, session)
    return session


@app.delete("/api/sessions/{session_id}")
async def api_delete_session(session_id: str) -> dict[str, bool]:
    return {"deleted": await run_in_threadpool(delete_session, session_id)}


# --- Vision / Design ---

class ImageAnalyzeInput(BaseModel):
    image_url: str = Field(min_length=1, max_length=2000)
    question: str = Field(default="请描述这张商品图片的内容，包括颜色、材质、形状、场景等特征，并提取可能的卖点。", max_length=500)


class ImageGenerateInput(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    size: str = Field(default="1024*1024", max_length=20)


class ImageAnalyzeResponse(BaseModel):
    description: str


class ImageGenerateResponse(BaseModel):
    task_id: str
    status: str


@app.post("/api/vision/analyze", response_model=ImageAnalyzeResponse)
async def api_analyze_image(req: ImageAnalyzeInput, settings: Settings = Depends(get_settings)) -> ImageAnalyzeResponse:
    if not settings.dashscope_api_key:
        raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.vision import analyze_image
        result = await analyze_image(req.image_url, req.question, settings)
        return ImageAnalyzeResponse(description=result)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"图片分析失败: {exc}") from exc


@app.post("/api/vision/generate", response_model=ImageGenerateResponse)
async def api_generate_image(req: ImageGenerateInput, settings: Settings = Depends(get_settings)) -> ImageGenerateResponse:
    if not settings.dashscope_api_key:
        raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.vision import generate_image
        result = await generate_image(req.prompt, settings, req.size)
        task_id = result.get("output", {}).get("task_id", "")
        return ImageGenerateResponse(task_id=task_id, status="submitted")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"图片生成失败: {exc}") from exc


@app.get("/api/vision/generate/{task_id}")
async def api_poll_image(task_id: str, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.dashscope_api_key:
        raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.vision import poll_image_task
        result = await poll_image_task(task_id, settings)
        return result
    except TimeoutError:
        raise HTTPException(status_code=408, detail="图片生成超时")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


# --- Studio ---

@app.get("/api/studio/templates")
async def api_studio_templates() -> dict:
    from app.design_image_prompts import ALL_TEMPLATES, TEMPLATES_BY_CATEGORY, PLATFORM_SIZES
    templates = [{"id": t.id, "name": t.name, "description": t.description, "aspect_ratio": t.aspect_ratio, "tags": t.tags, "prompt_template": t.prompt_template, "builtin": True} for t in ALL_TEMPLATES]
    categories = {k: {"name": v["name"], "template_ids": [t.id for t in v["templates"]]} for k, v in TEMPLATES_BY_CATEGORY.items()}
    # merge custom templates
    custom = _load_custom_templates()
    for ct in custom:
        templates.append(ct)
        cat = ct.get("category", "lifestyle")
        if cat not in categories:
            categories[cat] = {"name": ct.get("category_name", cat), "template_ids": []}
        categories[cat]["template_ids"].append(ct["id"])
    return {"templates": templates, "categories": categories, "platform_sizes": PLATFORM_SIZES}


CUSTOM_TEMPLATES_FILE = Path(__file__).resolve().parent / "data" / "custom_scene_templates.json"

def _load_custom_templates() -> list[dict]:
    try:
        if CUSTOM_TEMPLATES_FILE.exists():
            data = json.loads(CUSTOM_TEMPLATES_FILE.read_text())
            return data if isinstance(data, list) else []
    except Exception:
        pass
    return []

def _save_custom_templates(templates: list[dict]) -> None:
    CUSTOM_TEMPLATES_FILE.parent.mkdir(parents=True, exist_ok=True)
    CUSTOM_TEMPLATES_FILE.write_text(json.dumps(templates, ensure_ascii=False, indent=2))


class CustomTemplateInput(BaseModel):
    name: str = Field(..., max_length=50)
    description: str = Field(default="", max_length=200)
    prompt_template: str = Field(..., max_length=1000)
    aspect_ratio: str = Field(default="1:1", max_length=10)
    tags: list[str] = Field(default_factory=list)
    category: str = Field(default="lifestyle")
    category_name: str = Field(default="自定义")


@app.post("/api/studio/templates/custom")
async def api_create_custom_template(body: CustomTemplateInput) -> dict:
    custom = _load_custom_templates()
    tid = f"custom-{uuid.uuid4().hex[:8]}"
    new_tpl = {
        "id": tid, "name": body.name, "description": body.description,
        "prompt_template": body.prompt_template, "aspect_ratio": body.aspect_ratio,
        "tags": body.tags, "builtin": False, "category": body.category,
        "category_name": body.category_name,
    }
    custom.append(new_tpl)
    _save_custom_templates(custom)
    return new_tpl


@app.delete("/api/studio/templates/custom/{template_id}")
async def api_delete_custom_template(template_id: str) -> dict:
    custom = _load_custom_templates()
    before = len(custom)
    custom = [t for t in custom if t.get("id") != template_id]
    _save_custom_templates(custom)
    return {"deleted": before != len(custom)}


class StudioProductInput(BaseModel):
    base_desc: str = Field(default="", max_length=500)
    image_b64: str = Field(default="", max_length=5000000)


class StudioAdjustInput(BaseModel):
    reference_b64: str = Field(min_length=1, max_length=5000000)
    instructions: str = Field(min_length=1, max_length=500)


class StudioSceneInput(BaseModel):
    product_ref_b64: str = Field(min_length=1, max_length=5000000)
    prompt: str = Field(min_length=1, max_length=500)


@app.post("/api/studio/generate-product")
async def api_studio_product(req: StudioProductInput, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.dashscope_api_key: raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    if not req.base_desc.strip() and not req.image_b64:
        raise HTTPException(status_code=422, detail="产品描述和图片至少提供一项")
    try:
        from app.studio import submit_product_view
        from starlette.concurrency import run_in_threadpool
        tid = await run_in_threadpool(submit_product_view, req.base_desc, req.image_b64, settings)
        return {"task_id": tid, "status": "submitted"}
    except Exception as exc: raise HTTPException(status_code=502, detail=f"三视图提交失败: {exc}")


@app.post("/api/studio/adjust-product")
async def api_studio_adjust(req: StudioAdjustInput, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.dashscope_api_key: raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.studio import submit_adjust
        from starlette.concurrency import run_in_threadpool
        tid = await run_in_threadpool(submit_adjust, req.reference_b64, req.instructions, settings)
        return {"task_id": tid, "status": "submitted"}
    except Exception as exc: raise HTTPException(status_code=502, detail=f"调整失败: {exc}")


@app.post("/api/studio/generate-scene")
async def api_studio_scene(req: StudioSceneInput, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.dashscope_api_key: raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.studio import submit_scene
        from starlette.concurrency import run_in_threadpool
        tid = await run_in_threadpool(submit_scene, req.product_ref_b64, req.prompt, settings)
        return {"task_id": tid, "status": "submitted"}
    except Exception as exc: raise HTTPException(status_code=502, detail=f"场景提交失败: {exc}")


@app.post("/api/studio/tweak-scene")
async def api_studio_tweak(req: StudioSceneInput, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.dashscope_api_key: raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.studio import submit_tweak
        from starlette.concurrency import run_in_threadpool
        tid = await run_in_threadpool(submit_tweak, req.product_ref_b64, req.prompt, settings)
        return {"task_id": tid, "status": "submitted"}
    except Exception as exc: raise HTTPException(status_code=502, detail=f"微调失败: {exc}")


@app.get("/api/studio/poll/{task_id}")
async def api_studio_poll(task_id: str, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.dashscope_api_key: raise HTTPException(status_code=503, detail="未配置 DashScope API Key")
    try:
        from app.studio import poll_task
        return await poll_task(task_id, settings)
    except TimeoutError: raise HTTPException(status_code=408, detail="超时")
    except Exception as exc: raise HTTPException(status_code=502, detail=str(exc))

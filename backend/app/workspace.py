"""内容工作台：商品事实、内容版本、知识来源、任务与发布效果。"""
import json
import re
import sqlite3
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from app import memory
from app.postprocess import post_process
from app.schemas import GeneratedContent, Platform

MIN_EXPERIMENT_IMPRESSIONS_PER_VARIANT = 300


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


@dataclass
class Product:
    id: str = field(default_factory=lambda: _id("product"))
    name: str = ""
    category: str = ""
    audience: str = ""
    selling_points: list[str] = field(default_factory=list)
    facts: list[str] = field(default_factory=list)
    prohibited_claims: list[str] = field(default_factory=list)
    notes: str = ""
    # 评论反哺：从真实用户评价中提炼的结构化洞察（None 表示尚未分析）
    review_insights: dict | None = None
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class QualityReport:
    score: int
    checks: list[dict[str, str | bool]]
    suggestions: list[str]


@dataclass
class ContentAsset:
    id: str = field(default_factory=lambda: _id("content"))
    product_id: str | None = None
    platform: str = Platform.XHS.value
    name: str = ""
    current_version: int = 1
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


@dataclass
class ContentVersion:
    id: str = field(default_factory=lambda: _id("version"))
    asset_id: str = ""
    version: int = 1
    content: dict = field(default_factory=dict)
    quality: dict = field(default_factory=dict)
    change_note: str = ""
    created_at: str = field(default_factory=_now)


@dataclass
class KnowledgeSource:
    id: str = field(default_factory=lambda: _id("source"))
    title: str = ""
    source_type: str = "platform_rule"
    platform: str | None = None
    content: str = ""
    url: str = ""
    updated_at: str = field(default_factory=_now)


@dataclass
class AgentTask:
    id: str = field(default_factory=lambda: _id("task"))
    objective: str = ""
    status: str = "planned"
    steps: list[dict[str, str]] = field(default_factory=list)
    result_summary: str = ""
    created_at: str = field(default_factory=_now)


@dataclass
class PerformanceRecord:
    id: str = field(default_factory=lambda: _id("metric"))
    asset_id: str = ""
    platform: str = ""
    impressions: int = 0
    engagements: int = 0
    clicks: int = 0
    add_to_carts: int = 0
    orders: int = 0
    conversions: int = 0
    refunds: int = 0
    revenue: float = 0
    ad_spend: float = 0
    notes: str = ""
    recorded_at: str = field(default_factory=_now)


@dataclass
class Experiment:
    """A/B 实验：同一商品同平台下，多个标题/钩子变体竞速，按转化率分胜负。"""
    id: str = field(default_factory=lambda: _id("exp"))
    product_id: str | None = None
    platform: str = Platform.XHS.value
    name: str = ""
    brief: str = ""
    # 每个变体：{label, title, hook, impressions, clicks, conversions}
    variants: list[dict] = field(default_factory=list)
    status: str = "running"          # running | decided
    winner_label: str | None = None
    confidence_level: str = "insufficient"  # insufficient | ready
    confidence_message: str = "尚未达到最小样本量"
    created_at: str = field(default_factory=_now)
    updated_at: str = field(default_factory=_now)


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(memory.DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS content_assets (
            id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS content_versions (
            id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, version INTEGER NOT NULL,
            data TEXT NOT NULL, created_at TEXT NOT NULL,
            UNIQUE(asset_id, version)
        );
        CREATE TABLE IF NOT EXISTS knowledge_sources (
            id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS agent_tasks (
            id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS performance_records (
            id TEXT PRIMARY KEY, asset_id TEXT NOT NULL, data TEXT NOT NULL, recorded_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS experiments (
            id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL
        );
    """)
    conn.commit()
    return conn


def _upsert(table: str, item_id: str, data: dict, timestamp_field: str = "updated_at") -> None:
    conn = _connect()
    try:
        stamp = str(data[timestamp_field])
        conn.execute(
            f"INSERT INTO {table} (id, data, {timestamp_field}) VALUES (?, ?, ?) "
            f"ON CONFLICT(id) DO UPDATE SET data = excluded.data, {timestamp_field} = excluded.{timestamp_field}",
            (item_id, json.dumps(data, ensure_ascii=False), stamp),
        )
        conn.commit()
    finally:
        conn.close()


def _list(table: str, cls: type, order_field: str = "updated_at") -> list:
    conn = _connect()
    try:
        rows = conn.execute(f"SELECT data FROM {table} ORDER BY {order_field} DESC").fetchall()
        return [cls(**json.loads(row["data"])) for row in rows]
    finally:
        conn.close()


def _get(table: str, item_id: str, cls: type):
    conn = _connect()
    try:
        row = conn.execute(f"SELECT data FROM {table} WHERE id = ?", (item_id,)).fetchone()
        return cls(**json.loads(row["data"])) if row else None
    finally:
        conn.close()


def save_product(product: Product) -> Product:
    product.updated_at = _now()
    _upsert("products", product.id, asdict(product))
    return product


def list_products() -> list[Product]:
    return _list("products", Product)


def get_product(product_id: str) -> Product | None:
    return _get("products", product_id, Product)


def delete_product(product_id: str) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def evaluate_quality(content: GeneratedContent, product: Product | None = None, warnings: list[str] | None = None) -> QualityReport:
    text = f"{content.title}\n{content.body}\n" + "\n".join(section.content for section in content.sections)
    checks: list[dict[str, str | bool]] = []
    suggestions: list[str] = []

    def add(name: str, passed: bool, detail: str, suggestion: str = "") -> None:
        checks.append({"name": name, "passed": passed, "detail": detail})
        if not passed and suggestion:
            suggestions.append(suggestion)

    add("标题完整", bool(content.title.strip()), "标题已填写" if content.title.strip() else "缺少标题", "补充可直接发布的标题")
    add("正文充实", len(content.body.strip()) >= 80, f"正文 {len(content.body.strip())} 字", "补充场景、卖点和自然转化表达")
    add("无待补充项", "[待补充" not in text, "没有占位项" if "[待补充" not in text else "仍有待补充事实", "补齐待补充事实后再发布")
    add("合规检查", not warnings, "未发现确定性风险" if not warnings else f"发现 {len(warnings or [])} 项风险", "处理全部合规警告")
    if product and product.prohibited_claims:
        found = [claim for claim in product.prohibited_claims if claim.lower() in text.lower()]
        add("商品禁用声明", not found, "未命中禁用声明" if not found else f"命中：{'、'.join(found)}", "移除商品禁用声明")
    if product:
        claims = set(re.findall(r"\d+(?:\.\d+)?\s*(?:ml|g|kg|cm|mm|小时|分钟|天|片|支|%|倍|美元|元)", text, re.IGNORECASE))
        known_text = " ".join(product.facts + product.selling_points).lower()
        unknown_claims = [claim for claim in claims if claim.lower().replace(" ", "") not in known_text.replace(" ", "")]
        add("事实一致性", not unknown_claims, "未发现未经确认的规格数字" if not unknown_claims else f"待核对：{'、'.join(unknown_claims)}", "移除或确认未经商品事实库支持的规格数字")
    if content.platform == Platform.DOUYIN:
        add("抖音分镜", len(content.sections) >= 3, f"{len(content.sections)} 个分镜", "至少补足 3 个分镜")
    elif content.platform == Platform.AMAZON:
        add("Amazon Bullet", len(content.sections) >= 3, f"{len(content.sections)} 条内容段落", "至少补足 3 条 Bullet Points")
    else:
        add("小红书标签", len(content.tags) >= 3, f"{len(content.tags)} 个标签", "至少补足 3 个精准标签")
    score = round(sum(1 for check in checks if check["passed"]) / len(checks) * 100)
    return QualityReport(score=score, checks=checks, suggestions=suggestions)


def create_content_asset(
    content: GeneratedContent,
    product_id: str | None = None,
    warnings: list[str] | None = None,
    change_note: str = "AI 初稿",
) -> tuple[ContentAsset, ContentVersion]:
    product = get_product(product_id) if product_id else None
    quality = evaluate_quality(content, product, warnings)
    asset = ContentAsset(product_id=product_id, platform=content.platform.value, name=content.title)
    _upsert("content_assets", asset.id, asdict(asset))
    version = ContentVersion(asset_id=asset.id, content=content.model_dump(mode="json"), quality=asdict(quality), change_note=change_note)
    _save_version(version)
    return asset, version


def _save_version(version: ContentVersion) -> None:
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO content_versions (id, asset_id, version, data, created_at) VALUES (?, ?, ?, ?, ?)",
            (version.id, version.asset_id, version.version, json.dumps(asdict(version), ensure_ascii=False), version.created_at),
        )
        conn.commit()
    finally:
        conn.close()


def add_content_version(asset_id: str, content: GeneratedContent, change_note: str) -> ContentVersion:
    asset = get_content_asset(asset_id)
    if not asset:
        raise ValueError("内容资产不存在")
    product = get_product(asset.product_id) if asset.product_id else None
    next_version = asset.current_version + 1
    quality = evaluate_quality(content, product, post_process(content).warnings)
    version = ContentVersion(asset_id=asset_id, version=next_version, content=content.model_dump(mode="json"), quality=asdict(quality), change_note=change_note)
    _save_version(version)
    asset.current_version = next_version
    asset.name = content.title
    asset.updated_at = _now()
    _upsert("content_assets", asset.id, asdict(asset))
    return version


def list_content_assets() -> list[ContentAsset]:
    return _list("content_assets", ContentAsset)


def get_content_asset(asset_id: str) -> ContentAsset | None:
    return _get("content_assets", asset_id, ContentAsset)


def delete_content_asset(asset_id: str) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute("DELETE FROM content_assets WHERE id = ?", (asset_id,))
        conn.execute("DELETE FROM content_versions WHERE asset_id = ?", (asset_id,))
        conn.execute("DELETE FROM performance_records WHERE asset_id = ?", (asset_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def list_content_versions(asset_id: str) -> list[ContentVersion]:
    conn = _connect()
    try:
        rows = conn.execute("SELECT data FROM content_versions WHERE asset_id = ? ORDER BY version DESC", (asset_id,)).fetchall()
        return [ContentVersion(**json.loads(row["data"])) for row in rows]
    finally:
        conn.close()


def get_current_version(asset_id: str) -> ContentVersion | None:
    versions = list_content_versions(asset_id)
    return versions[0] if versions else None


def save_knowledge_source(source: KnowledgeSource) -> KnowledgeSource:
    source.updated_at = _now()
    _upsert("knowledge_sources", source.id, asdict(source))
    return source


def list_knowledge_sources(platform: str | None = None) -> list[KnowledgeSource]:
    sources = _list("knowledge_sources", KnowledgeSource)
    return [source for source in sources if not platform or not source.platform or source.platform == platform]


def create_agent_task(objective: str) -> AgentTask:
    steps = [
        {"name": "读取品牌与商品事实", "status": "completed"},
        {"name": "检索平台知识来源", "status": "completed"},
        {"name": "生成或优化内容", "status": "pending"},
        {"name": "质量与合规检查", "status": "pending"},
        {"name": "记录发布效果", "status": "pending"},
    ]
    task = AgentTask(objective=objective, steps=steps)
    _upsert("agent_tasks", task.id, asdict(task), "created_at")
    return task


def complete_agent_task(task: AgentTask, result_summary: str) -> AgentTask:
    task.status = "completed"
    task.result_summary = result_summary
    for step in task.steps:
        if step["name"] != "记录发布效果":
            step["status"] = "completed"
    _upsert("agent_tasks", task.id, asdict(task), "created_at")
    return task


def fail_agent_task(task: AgentTask, error: str) -> AgentTask:
    task.status = "failed"
    task.result_summary = error[:300]
    for step in task.steps:
        if step["status"] == "pending":
            step["status"] = "failed"
            break
    _upsert("agent_tasks", task.id, asdict(task), "created_at")
    return task


def list_agent_tasks() -> list[AgentTask]:
    return _list("agent_tasks", AgentTask, "created_at")


def save_performance(record: PerformanceRecord) -> PerformanceRecord:
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO performance_records (id, asset_id, data, recorded_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET asset_id = excluded.asset_id, data = excluded.data, recorded_at = excluded.recorded_at",
            (record.id, record.asset_id, json.dumps(asdict(record), ensure_ascii=False), record.recorded_at),
        )
        conn.commit()
    finally:
        conn.close()
    return record


def save_performance_batch(records: list[PerformanceRecord]) -> None:
    conn = _connect()
    try:
        conn.executemany(
            "INSERT INTO performance_records (id, asset_id, data, recorded_at) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET asset_id = excluded.asset_id, data = excluded.data, recorded_at = excluded.recorded_at",
            [
                (record.id, record.asset_id, json.dumps(asdict(record), ensure_ascii=False), record.recorded_at)
                for record in records
            ],
        )
        conn.commit()
    finally:
        conn.close()


def list_performance(asset_id: str | None = None) -> list[PerformanceRecord]:
    records = _list("performance_records", PerformanceRecord, "recorded_at")
    return [record for record in records if not asset_id or record.asset_id == asset_id]


def build_performance_insights() -> dict[str, int | float | str]:
    records = list_performance()
    if not records:
        return {
            "records": 0, "impressions": 0, "clicks": 0, "add_to_carts": 0, "orders": 0,
            "conversions": 0, "refunds": 0, "revenue": 0, "ad_spend": 0, "click_rate": 0,
            "conversion_rate": 0, "click_conversion_rate": 0, "refund_rate": 0, "roas": 0,
            "summary": "发布后录入完整漏斗数据，ShopGenie 会据此优化下一版内容。",
        }
    impressions = sum(record.impressions for record in records)
    clicks = sum(record.clicks for record in records)
    add_to_carts = sum(record.add_to_carts for record in records)
    orders = sum(record.orders or record.conversions for record in records)
    conversions = sum(record.conversions for record in records)
    refunds = sum(record.refunds for record in records)
    revenue = round(sum(record.revenue for record in records), 2)
    ad_spend = round(sum(record.ad_spend for record in records), 2)
    click_rate = round(clicks / impressions * 100, 2) if impressions else 0
    conversion_rate = round(conversions / impressions * 100, 2) if impressions else 0
    click_conversion_rate = round(orders / clicks * 100, 2) if clicks else 0
    refund_rate = round(refunds / orders * 100, 2) if orders else 0
    roas = round(revenue / ad_spend, 2) if ad_spend else 0
    summary = f"已记录 {len(records)} 次发布，CTR {click_rate}%，点击后成交率 {click_conversion_rate}%，ROAS {roas}。"
    return {
        "records": len(records), "impressions": impressions, "clicks": clicks, "add_to_carts": add_to_carts,
        "orders": orders, "conversions": conversions, "refunds": refunds, "revenue": revenue,
        "ad_spend": ad_spend, "click_rate": click_rate, "conversion_rate": conversion_rate,
        "click_conversion_rate": click_conversion_rate, "refund_rate": refund_rate, "roas": roas, "summary": summary,
    }


# ── A/B 实验 ──

def _variant_cvr(variant: dict) -> float:
    impressions = variant.get("impressions") or 0
    return (variant.get("conversions") or 0) / impressions if impressions else 0.0


def compute_winner(experiment: Experiment) -> Experiment:
    """全部变体达到确定性样本门槛后，按转化率判定赢家。"""
    if len(experiment.variants) < 2:
        experiment.winner_label = None
        experiment.status = "running"
        experiment.confidence_level = "insufficient"
        experiment.confidence_message = "至少需要 2 个变体才能判定赢家"
        return experiment

    missing = [
        max(0, MIN_EXPERIMENT_IMPRESSIONS_PER_VARIANT - (variant.get("impressions") or 0))
        for variant in experiment.variants
    ]
    if any(missing):
        experiment.winner_label = None
        experiment.status = "running"
        experiment.confidence_level = "insufficient"
        experiment.confidence_message = (
            f"样本不足：每个变体至少需要 {MIN_EXPERIMENT_IMPRESSIONS_PER_VARIANT} 次曝光，"
            f"当前合计还差 {sum(missing)} 次"
        )
        return experiment

    best = max(experiment.variants, key=lambda v: (_variant_cvr(v), v.get("clicks") or 0, v.get("impressions") or 0))
    experiment.winner_label = best.get("label")
    experiment.status = "decided"
    experiment.confidence_level = "ready"
    experiment.confidence_message = (
        f"已达到确定性样本门槛：每个变体至少 {MIN_EXPERIMENT_IMPRESSIONS_PER_VARIANT} 次曝光；"
        "结果仅用于方向判断，不代表统计显著性"
    )
    return experiment


def save_experiment(experiment: Experiment) -> Experiment:
    compute_winner(experiment)
    experiment.updated_at = _now()
    _upsert("experiments", experiment.id, asdict(experiment))
    return experiment


def list_experiments(product_id: str | None = None) -> list[Experiment]:
    experiments = _list("experiments", Experiment)
    return [compute_winner(e) for e in experiments if not product_id or e.product_id == product_id]


def get_experiment(experiment_id: str) -> Experiment | None:
    return _get("experiments", experiment_id, Experiment)


def delete_experiment(experiment_id: str) -> bool:
    conn = _connect()
    try:
        cursor = conn.execute("DELETE FROM experiments WHERE id = ?", (experiment_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

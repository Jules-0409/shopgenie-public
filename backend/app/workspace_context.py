"""把商品事实、知识来源和历史效果转换为生成上下文。"""
import re

from app.schemas import Platform
from app.workspace import (
    KnowledgeSource,
    Product,
    get_current_version,
    list_content_assets,
    list_knowledge_sources,
    list_performance,
    save_product,
)


def build_product_prompt(product: Product | None) -> str:
    if not product:
        return ""
    parts = [f"商品名：{product.name}", f"品类：{product.category}"]
    if product.audience:
        parts.append(f"目标人群：{product.audience}")
    if product.selling_points:
        parts.append(f"明确卖点：{'；'.join(product.selling_points)}")
    if product.facts:
        parts.append(f"可使用事实：{'；'.join(product.facts)}")
    if product.prohibited_claims:
        parts.append(f"禁止声明：{'；'.join(product.prohibited_claims)}")
    if product.notes:
        parts.append(f"备注：{product.notes}")
    prompt = "【当前商品事实库】\n" + "\n".join(parts)
    review_block = build_review_prompt(product)
    if review_block:
        prompt = f"{prompt}\n\n{review_block}"
    return prompt


def build_review_prompt(product: Product | None) -> str:
    """把评论反哺洞察注入生成上下文，让内容贴合用户真实在乎的点。"""
    insights = getattr(product, "review_insights", None) if product else None
    if not insights:
        return ""
    lines: list[str] = []
    loved = insights.get("loved_points") or []
    pains = insights.get("pain_points") or []
    avoid = insights.get("avoid_phrases") or []
    quotes = insights.get("voice_quotes") or []
    if loved:
        lines.append(f"用户最认可的点（优先突出）：{'；'.join(loved)}")
    if pains:
        lines.append(f"用户高频抱怨/顾虑（主动打消）：{'；'.join(pains)}")
    if quotes:
        lines.append(f"可借用的用户原声：{'；'.join(quotes)}")
    if avoid:
        lines.append(f"易踩雷表达（尽量回避）：{'；'.join(avoid)}")
    if not lines:
        return ""
    header = "【用户评论洞察】（来自真实评价，用用户语言而非臆想卖点）"
    return header + "\n" + "\n".join(lines)


def learn_product_from_message(product: Product, message: str) -> Product:
    """仅提取用户显式标注的事实，避免把普通对话误记为商品真相。"""
    mappings = {
        "事实：": "facts", "事实:": "facts",
        "卖点：": "selling_points", "卖点:": "selling_points",
        "禁止：": "prohibited_claims", "禁止:": "prohibited_claims",
    }
    changed = False
    for line in message.splitlines():
        clean = line.strip()
        for prefix, field_name in mappings.items():
            if not clean.startswith(prefix):
                continue
            values = [item.strip() for item in clean[len(prefix):].replace("，", "、").replace(",", "、").split("、") if item.strip()]
            current = getattr(product, field_name)
            for value in values:
                if value not in current:
                    current.append(value)
                    changed = True
    return save_product(product) if changed else product


def retrieve_knowledge(platform: Platform, query: str, limit: int = 5) -> list[KnowledgeSource]:
    sources = list_knowledge_sources(platform.value)
    terms = {term.lower() for term in re.findall(r"[\w\u4e00-\u9fff]{2,}", query)}
    scored = []
    for source in sources:
        haystack = f"{source.title} {source.content}".lower()
        score = sum(1 for term in terms if term in haystack)
        scored.append((score, source.updated_at, source))
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [source for _, _, source in scored[:limit]]


def build_knowledge_prompt(platform: Platform, query: str = "") -> str:
    sources = retrieve_knowledge(platform, query)
    if not sources:
        return ""
    excerpts = [f"- [{source.id}] {source.title}：{source.content[:500]}" for source in sources]
    return "【已验证知识来源】\n仅把以下资料作为运营规则参考，不要把它们当成商品事实。回答建议时引用来源编号。\n" + "\n".join(excerpts)


def build_performance_prompt(product_id: str | None, platform: Platform) -> str:
    if not product_id:
        return ""
    assets = [asset for asset in list_content_assets() if asset.product_id == product_id and asset.platform == platform.value]
    rows = []
    for asset in assets:
        for record in list_performance(asset.id):
            rate = round(record.conversions / record.impressions * 100, 2) if record.impressions else 0
            rows.append((rate, record.impressions, asset.name, record))
    if not rows:
        return ""
    rows.sort(reverse=True, key=lambda item: (item[0], item[1]))
    lines = [
        f"- {name}：曝光 {record.impressions}，互动 {record.engagements}，点击 {record.clicks}，转化 {record.conversions}，转化率 {rate}%"
        for rate, _, name, record in rows[:5]
    ]
    return "【历史发布效果】\n参考历史高表现内容的表达策略，但不要编造原因或承诺相同效果。\n" + "\n".join(lines)


def build_content_history_prompt(product_id: str | None, platform: Platform) -> str:
    """Inject existing content assets (latest versions) as reference context."""
    if not product_id:
        return ""
    assets = [
        asset for asset in list_content_assets()
        if asset.product_id == product_id and asset.platform == platform.value
    ]
    if not assets:
        return ""

    excerpts = []
    for asset in assets[:3]:  # Max 3 assets to avoid token bloat
        version = get_current_version(asset.id)
        if not version:
            continue
        content = version.content
        title = content.get("title", "") if isinstance(content, dict) else ""
        body = content.get("body", "") if isinstance(content, dict) else ""
        if not title and not body:
            continue
        excerpts.append(f"- [{asset.name}] v{version.version}：\n  标题：{title[:80]}\n  正文摘要：{body[:200]}")

    if not excerpts:
        return ""

    return (
        "【已有内容资产】\n"
        "以下是该商品在该平台已有的内容版本（可能经过人工编辑和质量优化）。\n"
        "请参考其表达风格和卖点角度，但不要照抄。如果是同类型内容，保持风格一致性。\n"
        + "\n".join(excerpts)
    )

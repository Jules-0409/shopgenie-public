"""A/B 实验：为同一商品同平台生成多个标题/钩子变体，供真实投放竞速。

变体只测最关键的"前 3 秒"——标题 + 开头钩子，而非整篇内容，因为标题/钩子
是转化率差异的主要来源，且录入成本低。赢家由 build_experiment_prompt 反哺生成。
"""

import logging

from app.config import Settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.schemas import Platform
from app.workspace import Product

logger = logging.getLogger(__name__)

MAX_VARIANTS = 5
LABELS = ["A", "B", "C", "D", "E"]

PLATFORM_HINT = {
    Platform.XHS.value: "小红书：标题要有情绪张力或好奇缺口，钩子是第一人称的真实场景。",
    Platform.DOUYIN.value: "抖音：标题口语化，钩子是 3 秒留人的冲突或悬念。",
    Platform.AMAZON.value: "Amazon：标题英文、关键词前置，钩子是第一条 bullet 的核心 benefit。",
    Platform.CS.value: "客服：标题是场景名，钩子是开场的安抚或引导话术。",
}

SYSTEM_PROMPT = """你是电商 A/B 测试专家。针对同一个商品，产出多个**风格明显不同**的标题 + 开头钩子变体，
让用户拿去真实投放、对比转化。每个变体走不同策略（如：痛点切入 / 好奇缺口 / 数字利益 / 场景代入 / 反差对比），不要雷同。

只返回 JSON：
{
  "variants": [
    {"title": "变体标题", "hook": "开头第一句钩子", "angle": "该变体的策略一词（如 痛点/好奇/数字）"}
  ]
}

规则：
- 严格基于用户给的商品信息，不编造功效、成分、规格。
- title 和 hook 都要短、可直接用；angle 用 2-4 字概括策略。
- 变体之间策略要拉开差距，这是 A/B 的意义。"""


def _normalize_variants(raw: object, n: int) -> list[dict]:
    if not isinstance(raw, list):
        return []
    out: list[dict] = []
    for i, item in enumerate(raw[:n]):
        if not isinstance(item, dict):
            continue
        title = str(item.get("title", "")).strip()
        hook = str(item.get("hook", "")).strip()
        if not title and not hook:
            continue
        out.append({
            "label": LABELS[len(out)] if len(out) < len(LABELS) else str(len(out) + 1),
            "title": title,
            "hook": hook,
            "angle": str(item.get("angle", "")).strip()[:12],
            "impressions": 0,
            "clicks": 0,
            "conversions": 0,
        })
    return out


async def generate_variants(
    product: Product | None,
    platform: str,
    brief: str,
    settings: Settings,
    n: int = 3,
    client: DeepSeekClient | None = None,
) -> list[dict]:
    """生成 n 个标题/钩子变体（带 A/B/C 标签和清零的指标）。

    brief 与商品信息都为空时抛 ValueError；模型失败抛 DeepSeekError。
    """
    n = max(2, min(n, MAX_VARIANTS))
    brief = (brief or "").strip()
    has_product = bool(product and (product.name or product.selling_points or product.facts))
    if not brief and not has_product:
        raise ValueError("请先描述商品或选择一个商品事实库")

    parts = []
    if product and product.name:
        parts.append(f"商品：{product.name}（{product.category}）")
    if product and product.selling_points:
        parts.append(f"卖点：{'；'.join(product.selling_points)}")
    if product and product.facts:
        parts.append(f"事实：{'；'.join(product.facts)}")
    if brief:
        parts.append(f"补充要求：{brief}")
    hint = PLATFORM_HINT.get(platform, "")
    user_prompt = f"{hint}\n\n{chr(10).join(parts)}\n\n请产出 {n} 个差异明显的标题+钩子变体。"

    deepseek = client or DeepSeekClient(settings, product=product)
    raw = await deepseek.complete_json(SYSTEM_PROMPT, user_prompt)
    variants = _normalize_variants(raw.get("variants") if isinstance(raw, dict) else None, n)
    if not variants:
        raise DeepSeekError("变体生成结果为空")
    return variants

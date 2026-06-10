"""评论反哺（Review Mining）：从真实用户评价中提炼结构化洞察，反哺内容生成。

把"模型臆想卖点"升级为"用户真实在乎的卖点"——抬高所有生成场景的质量上限。
洞察以 dict 形式存进 Product.review_insights，由 build_review_prompt 注入生成上下文。
"""

import logging

from app.config import Settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.workspace import Product

logger = logging.getLogger(__name__)

# 单次分析的评论文本上限，避免超长输入炸 token / 拖慢响应
MAX_REVIEW_CHARS = 20_000

REVIEW_SYSTEM_PROMPT = """你是电商运营分析师。用户会给你一批某商品的真实买家评价。
你的任务是提炼可直接用于内容创作的结构化洞察，必须严格基于评价原文，不得编造。

只返回 JSON，结构如下：
{
  "loved_points": ["买家高频称赞的具体卖点，用买家的话，3-6 条"],
  "pain_points": ["买家高频抱怨/顾虑/差评原因，3-6 条；没有则空数组"],
  "avoid_phrases": ["容易引发反感或与差评相关的表达，内容创作时应回避，0-5 条"],
  "voice_quotes": ["可直接借用的买家原声金句，保留口语感，3-6 条"],
  "summary": "一句话总结这批评价反映的核心卖点与风险（30 字内）"
}

规则：
- 全部用中文（除非评价本身是外文，则保留关键外文原词）。
- loved_points / pain_points 要具体（"敷完不卡粉"而非"效果好"）。
- 不要泛泛而谈，不要营销腔，提炼买家真实在乎的点。
- 任何字段无内容时返回空数组或空字符串，不要编造。"""


def _normalize_list(value: object, limit: int = 8) -> list[str]:
    """把模型返回的任意值规整成去重、非空、限长的字符串列表。"""
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        text = str(item).strip()
        if text and text not in seen:
            seen.add(text)
            out.append(text)
        if len(out) >= limit:
            break
    return out


def normalize_insights(raw: dict, review_count: int) -> dict:
    """把模型原始输出规整为稳定的 review_insights 结构。"""
    return {
        "loved_points": _normalize_list(raw.get("loved_points")),
        "pain_points": _normalize_list(raw.get("pain_points")),
        "avoid_phrases": _normalize_list(raw.get("avoid_phrases"), limit=5),
        "voice_quotes": _normalize_list(raw.get("voice_quotes")),
        "summary": str(raw.get("summary", "")).strip()[:120],
        "review_count": review_count,
    }


def _estimate_review_count(reviews: str) -> int:
    """粗略统计评论条数：按换行非空行计。"""
    return sum(1 for line in reviews.splitlines() if line.strip())


async def analyze_reviews(
    reviews: str,
    settings: Settings,
    product: Product | None = None,
    client: DeepSeekClient | None = None,
) -> dict:
    """分析评论文本，返回规整后的 review_insights dict。

    reviews 为空或全空白时抛 ValueError（由路由转 422）。
    模型/网络失败时抛 DeepSeekError（由路由转 502）。
    """
    text = (reviews or "").strip()
    if not text:
        raise ValueError("评论内容为空")
    if len(text) > MAX_REVIEW_CHARS:
        text = text[:MAX_REVIEW_CHARS]
        logger.info("评论文本超过 %s 字符，已截断分析", MAX_REVIEW_CHARS)

    context = ""
    if product and product.name:
        context = f"商品：{product.name}（{product.category}）\n\n"
    user_prompt = f"{context}以下是买家评价，请提炼洞察：\n\n{text}"

    deepseek = client or DeepSeekClient(settings, product=product)
    raw = await deepseek.complete_json(REVIEW_SYSTEM_PROMPT, user_prompt)
    if not isinstance(raw, dict):
        raise DeepSeekError("评论分析返回了非预期结构")
    return normalize_insights(raw, _estimate_review_count(text))

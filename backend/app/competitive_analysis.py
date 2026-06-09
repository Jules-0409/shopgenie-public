"""竞品分析闭环：搜索同类内容 → 提取规律 → 注入生成上下文。"""
import logging
from dataclasses import dataclass

from app.schemas import Platform
from app.web_search import search_public_web

logger = logging.getLogger(__name__)

PLATFORM_SEARCH_TEMPLATES: dict[Platform, dict[str, str]] = {
    Platform.XHS: {
        "search": "小红书 {category} 推荐 爆款 笔记",
        "extract_hint": "提取标题句式、高频标签、正文结构、开头Hook风格",
    },
    Platform.DOUYIN: {
        "search": "抖音 {category} 短视频 爆款 脚本",
        "extract_hint": "提取视频标题、Hook句式、分镜结构、时长分布",
    },
    Platform.AMAZON: {
        "search": "Amazon best seller {category} listing tips",
        "extract_hint": "Extract title structure, bullet point patterns, keyword strategies",
    },
}


@dataclass
class CompetitiveInsight:
    category: str
    platform: Platform
    raw_results: list[dict[str, str]]  # title, url, snippet
    analysis: str  # LLM-generated analysis


async def search_competitors(category: str, platform: Platform) -> list[dict[str, str]]:
    """Search for competitor content on the given platform."""
    template = PLATFORM_SEARCH_TEMPLATES.get(platform, PLATFORM_SEARCH_TEMPLATES[Platform.XHS])
    query = template["search"].format(category=category)

    results = await search_public_web(query)
    return [
        {"title": title, "url": url, "snippet": snippet}
        for title, url, snippet in results
    ]


def build_competitive_context(
    category: str,
    platform: Platform,
    results: list[dict[str, str]],
) -> str:
    """Build a prompt context from competitor search results.
    This is a lightweight analysis that doesn't require an LLM call -
    it extracts patterns directly from the search snippets."""
    if not results:
        return ""

    template = PLATFORM_SEARCH_TEMPLATES.get(platform, PLATFORM_SEARCH_TEMPLATES[Platform.XHS])

    # Extract titles and snippets
    titles = [r["title"][:100] for r in results[:5]]
    snippets = [r["snippet"][:200] for r in results[:5] if r.get("snippet")]

    parts = [
        f"【竞品参考 — {category}】",
        f"以下是{platform.value}平台上同类{category}内容的公开信息，仅供参考表达风格和趋势，不能当成商品事实：",
        "",
        "参考标题：",
    ]
    for i, title in enumerate(titles, 1):
        parts.append(f"  {i}. {title}")

    if snippets:
        parts.append("")
        parts.append("参考摘要：")
        for i, snippet in enumerate(snippets[:3], 1):
            parts.append(f"  {i}. {snippet[:150]}")

    parts.extend([
        "",
        f"分析方向：{template['extract_hint']}",
        "注意：以上仅为竞品公开信息参考，禁止照抄，禁止把这些内容当成你的商品事实。",
    ])

    return "\n".join(parts)

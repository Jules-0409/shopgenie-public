"""后处理模块：违禁词检测 + 平台规则检查"""
import re
from dataclasses import dataclass, field

from app.schemas import GeneratedContent, Platform


@dataclass
class PostProcessResult:
    warnings: list[str] = field(default_factory=list)
    banned_words_found: list[str] = field(default_factory=list)


# 广告法违禁词（通用）
AD_LAW_BANNED = [
    "最好", "最佳", "第一", "顶级", "极致", "绝对", "万能", "100%", "纯天然",
    "零添加", "无副作用", "根治", "药到病除", "永不反弹", "一次见效",
    "国家级", "世界级", "全网最低", "史上最", "独一无二",
]

# 平台特定违禁词
PLATFORM_BANNED: dict[Platform, list[str]] = {
    Platform.XHS: [
        "最好用", "必买", "不买后悔", "秒杀", "限时抢", "下单", "购买链接",
        "加微信", "私聊", "V我", "wx",
    ],
    Platform.DOUYIN: [
        "点击购物车", "立即下单", "不买后悔一辈子", "最后一天", "限时秒杀",
        "加微信", "私聊", "V我",
    ],
    Platform.AMAZON: [
        "best product", "guaranteed", "miracle", "cure", "100% effective",
        "FDA approved", "clinically proven",
    ],
}


def check_banned_words(content: GeneratedContent, custom_banned: list[str] | None = None) -> PostProcessResult:
    """检测成品内容中的违禁词"""
    result = PostProcessResult()
    full_text = f"{content.title} {content.body} {' '.join(t for t in content.tags)}"

    # 通用广告法违禁词
    for word in AD_LAW_BANNED:
        if word in full_text:
            result.banned_words_found.append(word)
            result.warnings.append(f"⚠️ 广告法违禁词：「{word}」")

    # 平台特定违禁词
    platform_words = PLATFORM_BANNED.get(content.platform, [])
    for word in platform_words:
        if word.lower() in full_text.lower():
            result.banned_words_found.append(word)
            result.warnings.append(f"⚠️ {content.platform.value} 平台违禁词：「{word}」")

    for word in custom_banned or []:
        clean_word = word.strip()
        if clean_word and clean_word.lower() in full_text.lower():
            result.banned_words_found.append(clean_word)
            result.warnings.append(f"⚠️ 品牌禁忌词：「{clean_word}」")

    return result


def check_platform_rules(content: GeneratedContent) -> PostProcessResult:
    """检查平台内容规范"""
    result = PostProcessResult()

    if content.platform == Platform.XHS:
        # 小红书：不能太硬广
        hard_sell_patterns = [r"下单", r"购买", r"链接.*评论", r"加.*微信"]
        for pattern in hard_sell_patterns:
            if re.search(pattern, content.body):
                result.warnings.append(f"💡 小红书建议：检测到硬广语气「{pattern}」，建议改为更自然的表达")

        # 小红书：标题长度建议
        if len(content.title) > 20:
            result.warnings.append("💡 小红书建议：标题超过 20 字可能被截断，建议精简")

    elif content.platform == Platform.DOUYIN:
        # 抖音：脚本时长检查
        if content.sections:
            total_sections = len(content.sections)
            if total_sections < 2:
                result.warnings.append("💡 抖音建议：脚本分镜太少，建议至少 3 个分镜")

    elif content.platform == Platform.AMAZON:
        # Amazon：标题长度
        if len(content.title) > 200:
            result.warnings.append("💡 Amazon 建议：标题超过 200 字符，可能被截断")

        # Amazon：Bullet Points 数量
        bp_count = len([s for s in content.sections if "bullet" in s.label.lower() or "卖点" in s.label])
        if content.sections and bp_count < 3:
            result.warnings.append("💡 Amazon 建议：建议至少 3 条 Bullet Points")

    return result


def post_process(content: GeneratedContent, custom_banned: list[str] | None = None) -> PostProcessResult:
    """完整后处理流程"""
    result = check_banned_words(content, custom_banned)
    platform_result = check_platform_rules(content)
    result.warnings.extend(platform_result.warnings)
    return result

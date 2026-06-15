"""平台强契约：确定性结构校验器 + 自动矫正"""
import re
from dataclasses import dataclass, field

from app.schemas import ChatRequest, ContentType, GeneratedContent, Platform


@dataclass
class ValidationResult:
    valid: bool = True
    errors: list[str] = field(default_factory=list)
    auto_fixed: bool = False
    fixed_content: GeneratedContent | None = None


def _is_primarily_chinese(text: str) -> bool:
    """Check if text is primarily Chinese characters."""
    if not text.strip():
        return False
    chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
    total_chars = len(re.findall(r'\S', text))
    if total_chars == 0:
        return False
    return chinese_chars / total_chars > 0.3


def _is_primarily_english(text: str) -> bool:
    """Check if text is primarily English."""
    if not text.strip():
        return False
    english_chars = len(re.findall(r'[a-zA-Z]', text))
    total_chars = len(re.findall(r'\S', text))
    if total_chars == 0:
        return False
    return english_chars / total_chars > 0.5


def _has_time_markers(text: str) -> bool:
    """Check if text contains time markers like 0-3s, 3–12秒, etc."""
    return bool(re.search(r'\d+\s*[-–—]\s*\d+\s*[s秒]', text))


def build_cross_platform_choice(request: ChatRequest) -> tuple[str, list[dict[str, list[str] | str]]] | None:
    """Intercept explicit requests to generate for a platform other than the session platform."""
    text = request.message.lower()
    generation_terms = ("生成", "写一", "写个", "做一", "做个", "改成", "转换成", "脚本", "文案", "listing")
    if not any(term in text for term in generation_terms):
        return None
    platform_terms = {
        Platform.XHS: ("小红书", "xiaohongshu"),
        Platform.DOUYIN: ("抖音", "douyin"),
        Platform.AMAZON: ("amazon", "亚马逊"),
        Platform.CS: ("客服话术", "客服模板", "客服回复", "售后话术", "售后模板"),
    }
    current_terms = platform_terms.get(request.platform)
    if current_terms is None:
        return None
    if any(term in text for term in current_terms):
        return None
    target = next(
        (platform for platform, terms in platform_terms.items() if platform != request.platform and any(term in text for term in terms)),
        None,
    )
    if target is None:
        return None
    labels = {
        Platform.XHS: "小红书",
        Platform.DOUYIN: "抖音",
        Platform.AMAZON: "Amazon",
        Platform.CS: "客服话术",
    }
    current_label = labels.get(request.platform, request.platform.value)
    target_label = labels[target]
    message = f"当前是{current_label}会话，不能静默生成{target_label}格式。请选择如何继续："
    questions = [{
        "question": "如何处理这次跨平台需求？",
        "options": [f"转换为{current_label}内容", f"新建{target_label}会话后生成"],
    }]
    return message, questions


def validate_xhs(content: GeneratedContent) -> ValidationResult:
    """Validate Xiaohongshu content structure."""
    result = ValidationResult()

    if not _is_primarily_chinese(content.title):
        result.errors.append("小红书标题必须是中文")
        result.valid = False

    if not _is_primarily_chinese(content.body):
        result.errors.append("小红书正文必须是中文")
        result.valid = False

    if len(content.tags) == 0:
        result.errors.append("小红书笔记至少需要 1 个标签")
        result.valid = False

    full_text = f"{content.title}\n{content.body}\n" + "\n".join(f"{s.label}\n{s.content}" for s in content.sections)
    if _has_time_markers(full_text):
        result.errors.append("小红书笔记不得包含分秒脚本结构")
        result.valid = False

    # Check for Amazon-style content pollution
    if _is_primarily_english(content.body):
        result.errors.append("检测到英文内容，疑似 Amazon 格式污染")
        result.valid = False

    return result


def validate_douyin(content: GeneratedContent) -> ValidationResult:
    """Validate Douyin script or product-copy structure."""
    result = ValidationResult()

    if not _is_primarily_chinese(content.title):
        result.errors.append("抖音脚本标题必须是中文")
        result.valid = False

    if not _is_primarily_chinese(content.body):
        result.errors.append("抖音脚本正文必须是中文")
        result.valid = False

    if content.content_type == ContentType.DOUYIN_PRODUCT_COPY:
        full_text = f"{content.title}\n{content.body}\n" + "\n".join(f"{s.label}\n{s.content}" for s in content.sections)
        if _has_time_markers(full_text):
            result.errors.append("抖音商品文案不得包含时间分镜结构")
            result.valid = False
        if len(content.body.strip()) < 30:
            result.errors.append("抖音商品文案需要完整商品详情")
            result.valid = False
        if len(content.sections) < 2:
            result.errors.append("抖音商品文案至少需要核心卖点和商品详情两个段落")
            result.valid = False
        return result

    if len(content.sections) < 3:
        result.errors.append("抖音脚本至少需要 3 个分镜")
        result.valid = False
        return result

    for index, section in enumerate(content.sections, start=1):
        combined = f"{section.label} {section.content}"
        if not _has_time_markers(combined):
            result.errors.append(f"抖音脚本第 {index} 个分镜缺少明确时间段")
        if not re.search(r"镜头|画面|特写|展示|拍摄|场景", combined):
            result.errors.append(f"抖音脚本第 {index} 个分镜缺少画面/镜头说明")
        if not re.search(r"口播|台词|旁白|说[:：]|主播", combined):
            result.errors.append(f"抖音脚本第 {index} 个分镜缺少口播")
    first = f"{content.sections[0].label} {content.sections[0].content}"
    last = f"{content.sections[-1].label} {content.sections[-1].content}"
    if not re.search(r"hook|钩子|开头|留人|冲突|好奇", first, re.IGNORECASE):
        result.errors.append("抖音脚本开头缺少 Hook")
    if not re.search(r"转化|引导|下单|链接|购物车|行动", last):
        result.errors.append("抖音脚本结尾缺少转化动作")
    if result.errors:
        result.valid = False

    return result


def validate_amazon(content: GeneratedContent) -> ValidationResult:
    """Validate Amazon Listing structure."""
    result = ValidationResult()

    if not _is_primarily_english(content.title):
        result.errors.append("Amazon 标题必须是英文")
        result.valid = False

    if not _is_primarily_english(content.body):
        result.errors.append("Amazon 正文必须是英文")
        result.valid = False

    if not 3 <= len(content.sections) <= 5:
        result.errors.append("Amazon Listing 需要 3-5 条 Bullet Points")
        result.valid = False
    for section in content.sections:
        if not _is_primarily_english(f"{section.label} {section.content}"):
            result.errors.append("Amazon Bullet Points 必须使用英文")
            result.valid = False
            break

    return result


def validate_cs(content: GeneratedContent) -> ValidationResult:
    """Validate customer service templates — sections are the actual content."""
    result = ValidationResult()

    if not _is_primarily_chinese(content.title):
        result.errors.append("客服话术标题必须是中文")
        result.valid = False

    # body 是使用说明/元信息，不做语言校验
    # 核心校验：至少 3 个场景，每个场景有实质内容
    if len(content.sections) < 3:
        result.errors.append("客服话术至少需要 3 个场景")
        result.valid = False
    else:
        empty_sections = [s.label for s in content.sections if not s.content.strip()]
        if empty_sections:
            result.errors.append(f"以下场景内容为空：{', '.join(empty_sections)}")
            result.valid = False

    return result


VALIDATORS = {
    Platform.XHS: validate_xhs,
    Platform.DOUYIN: validate_douyin,
    Platform.AMAZON: validate_amazon,
    Platform.CS: validate_cs,
}


def validate_platform_content(content: GeneratedContent) -> ValidationResult:
    """Run platform-specific structural validation."""
    validator = VALIDATORS.get(content.platform)
    if not validator:
        return ValidationResult()
    return validator(content)


def try_auto_fix_language(content: GeneratedContent) -> GeneratedContent | None:
    """Try to auto-fix language issues by swapping title/body markers.
    Returns fixed content if fixable, None if not."""
    # If Amazon content is in Chinese, it's likely a model error - can't auto-fix
    # If XHS/Douyin content is in English, it's likely Amazon pollution - can't auto-fix
    # These need re-generation, not deterministic fix
    return None

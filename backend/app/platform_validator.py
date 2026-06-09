"""平台强契约：确定性结构校验器 + 自动矫正"""
import re
from dataclasses import dataclass, field

from app.schemas import GeneratedContent, Platform


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

    # Check for Amazon-style content pollution
    if _is_primarily_english(content.body):
        result.errors.append("检测到英文内容，疑似 Amazon 格式污染")
        result.valid = False

    return result


def validate_douyin(content: GeneratedContent) -> ValidationResult:
    """Validate Douyin script structure."""
    result = ValidationResult()

    if not _is_primarily_chinese(content.title):
        result.errors.append("抖音脚本标题必须是中文")
        result.valid = False

    if not _is_primarily_chinese(content.body):
        result.errors.append("抖音脚本正文必须是中文")
        result.valid = False

    # Check for time markers in sections or body
    has_markers = _has_time_markers(content.body)
    if not has_markers:
        for section in content.sections:
            if _has_time_markers(section.content) or _has_time_markers(section.label):
                has_markers = True
                break

    if not has_markers and len(content.sections) < 2:
        result.errors.append("抖音脚本需要包含时间分镜结构（如 0-3s、3-12s）或至少 2 个分镜段落")
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

    if len(content.sections) < 2:
        result.errors.append("Amazon Listing 至少需要 2 条 Bullet Points")
        result.valid = False

    return result


def validate_cs(content: GeneratedContent) -> ValidationResult:
    """Validate customer service templates."""
    result = ValidationResult()

    if not _is_primarily_chinese(content.title):
        result.errors.append("客服话术标题必须是中文")
        result.valid = False

    if not _is_primarily_chinese(content.body):
        result.errors.append("客服话术正文必须是中文")
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

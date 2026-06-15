from app.platform_validator import (
    validate_xhs,
    validate_douyin,
    validate_amazon,
    validate_platform_content,
    _is_primarily_chinese,
    _is_primarily_english,
    _has_time_markers,
)
from app.schemas import ChatRequest, ContentSection, ContentType, GeneratedContent, Platform
from app.platform_validator import build_cross_platform_choice


def make_content(platform: Platform, title: str, body: str, tags=None, sections=None):
    return GeneratedContent(
        platform=platform, title=title, body=body,
        tags=tags or [], sections=sections or [],
    )


# --- Xiaohongshu ---

def test_xhs_valid_chinese_content():
    content = make_content(Platform.XHS, "干皮姐妹别划走！", "这个面膜真的很好用，敷完脸超水润。", tags=["面膜推荐"])
    result = validate_xhs(content)
    assert result.valid


def test_xhs_rejects_english_title():
    content = make_content(Platform.XHS, "Best face mask ever", "这个面膜真的很好用", tags=["面膜"])
    result = validate_xhs(content)
    assert not result.valid
    assert any("中文" in e for e in result.errors)


def test_xhs_rejects_english_body():
    content = make_content(Platform.XHS, "好用的面膜", "This is the best mask I have ever used, it works great.", tags=["面膜"])
    result = validate_xhs(content)
    assert not result.valid


def test_xhs_rejects_no_tags():
    content = make_content(Platform.XHS, "好用的面膜", "这个面膜真的很好用。", tags=[])
    result = validate_xhs(content)
    assert not result.valid
    assert any("标签" in e for e in result.errors)


def test_xhs_rejects_amazon_pollution():
    content = make_content(Platform.XHS, "Product Title", "High quality material, great for daily use. Buy now!", tags=["test"])
    result = validate_xhs(content)
    assert not result.valid


def test_xhs_rejects_timed_script_pollution():
    content = make_content(Platform.XHS, "面膜分享", "0-3秒 镜头展示面膜，口播介绍卖点。", tags=["面膜"])
    result = validate_xhs(content)
    assert not result.valid
    assert any("分秒脚本" in error for error in result.errors)


# --- Douyin ---

def test_douyin_valid_script():
    content = make_content(
        Platform.DOUYIN, "30秒补水面膜脚本",
        "姐妹们我终于找到干皮的救星了！",
        sections=[
            ContentSection(label="0-3s Hook", content="镜头：面膜特写。口播：干皮姐妹先别划走。"),
            ContentSection(label="3-12s 展示", content="画面：展示面膜质地。口播：精华质地清爽。"),
            ContentSection(label="12-30s 转化", content="镜头：商品包装特写。口播：点击链接了解详情，引导行动。"),
        ],
    )
    result = validate_douyin(content)
    assert result.valid


def test_douyin_rejects_no_time_markers_and_few_sections():
    content = make_content(Platform.DOUYIN, "脚本", "姐妹们看这个面膜。", sections=[])
    result = validate_douyin(content)
    assert not result.valid
    assert any("分镜" in e or "时间" in e for e in result.errors)


def test_douyin_rejects_time_markers_without_complete_storyboards():
    content = make_content(Platform.DOUYIN, "补水面膜", "0-3s 开场\n3-12s 展示产品\n12-30s 引导下单")
    result = validate_douyin(content)
    assert not result.valid


def test_douyin_rejects_sections_without_time_camera_and_voiceover():
    content = make_content(
        Platform.DOUYIN, "脚本", "正文",
        sections=[
            ContentSection(label="开场", content="Hook"),
            ContentSection(label="展示", content="卖点"),
            ContentSection(label="收尾", content="转化"),
        ],
    )
    result = validate_douyin(content)
    assert not result.valid


def test_douyin_accepts_product_copy_without_storyboards():
    content = GeneratedContent(
        platform=Platform.DOUYIN,
        content_type=ContentType.DOUYIN_PRODUCT_COPY,
        title="轻量便携保温杯 通勤随行杯",
        body="适合通勤、办公和日常出行使用，杯身轻巧便携，商品信息清晰，可直接用于抖音小店详情页。",
        sections=[
            ContentSection(label="核心卖点", content="轻量杯身，随手放进通勤包。"),
            ContentSection(label="适用场景", content="适合办公桌、通勤和日常外出。"),
        ],
    )
    result = validate_douyin(content)
    assert result.valid


def test_douyin_product_copy_rejects_timed_script():
    content = GeneratedContent(
        platform=Platform.DOUYIN,
        content_type=ContentType.DOUYIN_PRODUCT_COPY,
        title="保温杯商品详情",
        body="0-3秒展示商品，随后介绍核心卖点和使用场景。",
        sections=[
            ContentSection(label="核心卖点", content="轻量便携。"),
            ContentSection(label="商品详情", content="适合通勤使用。"),
        ],
    )
    result = validate_douyin(content)
    assert not result.valid


# --- Amazon ---

def test_amazon_valid_listing():
    content = make_content(
        Platform.AMAZON, "Insulated Water Bottle 500ml - Lightweight & Leak Proof",
        "Keep your drinks hot or cold for hours with our premium insulated bottle.",
        sections=[
            ContentSection(label="Lightweight", content="Only 230g, easy to carry"),
            ContentSection(label="Leak Proof", content="Secure lid prevents spills"),
            ContentSection(label="Daily Use", content="Designed for work and travel"),
        ],
    )
    result = validate_amazon(content)
    assert result.valid


def test_amazon_rejects_chinese_title():
    content = make_content(
        Platform.AMAZON, "轻量保温杯 500ml",
        "Keep your drinks hot or cold for hours.",
        sections=[
            ContentSection(label="Lightweight", content="Only 230g"),
            ContentSection(label="Leak Proof", content="Secure lid"),
            ContentSection(label="Daily Use", content="Easy to carry"),
        ],
    )
    result = validate_amazon(content)
    assert not result.valid
    assert any("英文" in e for e in result.errors)


def test_amazon_rejects_chinese_body():
    content = make_content(
        Platform.AMAZON, "Premium Water Bottle",
        "这个保温杯质量很好，轻便好携带，适合上班族。",
        sections=[
            ContentSection(label="Lightweight", content="230g"),
            ContentSection(label="Leak Proof", content="No spills"),
            ContentSection(label="Daily Use", content="Easy to carry"),
        ],
    )
    result = validate_amazon(content)
    assert not result.valid


def test_amazon_rejects_few_sections():
    content = make_content(
        Platform.AMAZON, "Premium Water Bottle",
        "High quality insulated bottle for daily use.",
        sections=[ContentSection(label="Feature", content="Lightweight")],
    )
    result = validate_amazon(content)
    assert not result.valid
    assert any("Bullet" in e for e in result.errors)


# --- Cross-platform pollution ---

def test_amazon_content_rejected_as_xhs():
    """Amazon content should fail XHS validation."""
    content = make_content(Platform.XHS, "Premium Product", "High quality material for daily use.", tags=["test"])
    result = validate_platform_content(content)
    assert not result.valid


def test_xhs_content_rejected_as_amazon():
    """XHS content should fail Amazon validation."""
    content = make_content(Platform.AMAZON, "好用的面膜推荐", "这个面膜真的很好用，推荐给大家。", sections=[
        ContentSection(label="轻薄", content="超级薄"),
        ContentSection(label="补水", content="效果好"),
    ])
    result = validate_platform_content(content)
    assert not result.valid


def test_explicit_cross_platform_generation_requires_choice():
    choice = build_cross_platform_choice(ChatRequest(platform=Platform.XHS, message="帮我生成一个抖音脚本"))
    assert choice is not None
    message, questions = choice
    assert "不能静默生成抖音格式" in message
    assert questions[0]["options"] == ["转换为小红书内容", "新建抖音会话后生成"]


def test_discussing_another_platform_does_not_require_choice():
    assert build_cross_platform_choice(ChatRequest(platform=Platform.XHS, message="抖音最近有什么趋势？")) is None


def test_converting_foreign_example_to_current_platform_does_not_require_choice():
    request = ChatRequest(platform=Platform.XHS, message="把这份抖音脚本转换成小红书笔记")
    assert build_cross_platform_choice(request) is None

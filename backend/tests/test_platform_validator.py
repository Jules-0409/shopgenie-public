from app.platform_validator import (
    validate_xhs,
    validate_douyin,
    validate_amazon,
    validate_platform_content,
    _is_primarily_chinese,
    _is_primarily_english,
    _has_time_markers,
)
from app.schemas import ContentSection, GeneratedContent, Platform


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


# --- Douyin ---

def test_douyin_valid_script():
    content = make_content(
        Platform.DOUYIN, "30秒补水面膜脚本",
        "姐妹们我终于找到干皮的救星了！",
        sections=[
            ContentSection(label="0-3s Hook", content="开场口播"),
            ContentSection(label="3-12s 展示", content="产品展示"),
            ContentSection(label="12-30s 转化", content="引导下单"),
        ],
    )
    result = validate_douyin(content)
    assert result.valid


def test_douyin_rejects_no_time_markers_and_few_sections():
    content = make_content(Platform.DOUYIN, "脚本", "姐妹们看这个面膜。", sections=[])
    result = validate_douyin(content)
    assert not result.valid
    assert any("分镜" in e or "时间" in e for e in result.errors)


def test_douyin_accepts_with_time_markers_in_body():
    content = make_content(Platform.DOUYIN, "补水面膜", "0-3s 开场\n3-12s 展示产品\n12-30s 引导下单")
    result = validate_douyin(content)
    assert result.valid


def test_douyin_accepts_with_enough_sections():
    content = make_content(
        Platform.DOUYIN, "脚本", "正文",
        sections=[
            ContentSection(label="开场", content="Hook"),
            ContentSection(label="展示", content="卖点"),
            ContentSection(label="收尾", content="转化"),
        ],
    )
    result = validate_douyin(content)
    assert result.valid


# --- Amazon ---

def test_amazon_valid_listing():
    content = make_content(
        Platform.AMAZON, "Insulated Water Bottle 500ml - Lightweight & Leak Proof",
        "Keep your drinks hot or cold for hours with our premium insulated bottle.",
        sections=[
            ContentSection(label="Lightweight", content="Only 230g, easy to carry"),
            ContentSection(label="Leak Proof", content="Secure lid prevents spills"),
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

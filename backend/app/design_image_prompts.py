"""电商图片生成 Prompt 模板库。

专为设计助手生图功能提供的 prompt 模板，不污染其他模块。
通义万相 (Wanx 2.1) 优化版。
"""

from dataclasses import dataclass, field


@dataclass
class ImagePromptTemplate:
    """一个生图 prompt 模板。"""
    id: str
    name: str  # 中文名称
    description: str  # 适用场景说明
    prompt_template: str  # 含 {product} 占位符
    aspect_ratio: str = "1:1"  # 建议比例
    tags: list[str] = field(default_factory=list)


# ── 6 大类，每类 3 个模板，共 18 个 ──

STUDIO_SHOTS = [
    ImagePromptTemplate(
        id="studio-white",
        name="纯白底商品图",
        description="标准电商白底图，适合主图和详情页首屏",
        prompt_template=(
            "Professional product photography of {product}, "
            "pure white background, studio lighting, soft diffused light from front and above, "
            "sharp focus on product with subtle shadow on white surface, "
            "commercial e-commerce photography style, ultra high resolution, product occupies 80% of frame"
        ),
        aspect_ratio="1:1",
        tags=["白底图", "主图", "Studio"],
    ),
    ImagePromptTemplate(
        id="studio-gradient",
        name="渐变背景图",
        description="柔和渐变背景，更有氛围感的主图替代",
        prompt_template=(
            "Professional product photography of {product}, "
            "soft gradient background from light gray to white, studio lighting with rim light, "
            "minimalist aesthetic, clean composition, subtle reflection on polished surface, "
            "premium brand feel, 8k resolution, product perfectly centered"
        ),
        aspect_ratio="1:1",
        tags=["渐变", "品牌感", "主图"],
    ),
    ImagePromptTemplate(
        id="studio-color",
        name="品牌色背景",
        description="用品牌主题色做背景，适合品牌旗舰店统一风格",
        prompt_template=(
            "Product photography of {product}, on a {color} background, "
            "soft front lighting with gentle side fill, minimal shadow, "
            "clean modern composition, brand identity photography, "
            "professional e-commerce quality, sharp details"
        ),
        aspect_ratio="1:1",
        tags=["品牌色", "统一风格", "旗舰店"],
    ),
]

LIFESTYLE_SHOTS = [
    ImagePromptTemplate(
        id="lifestyle-desk",
        name="桌面场景",
        description="产品放在现代简约桌面上，适合数码、文具、美妆",
        prompt_template=(
            "Lifestyle product photography of {product}, placed on a modern minimalist wooden desk, "
            "natural window light from left side creating soft shadows, coffee cup and notebook nearby, "
            "warm and cozy atmosphere, shallow depth of field with blurred background, "
            "Instagram aesthetic, realistic texture and materials"
        ),
        aspect_ratio="3:4",
        tags=["场景图", "桌面", "生活方式"],
    ),
    ImagePromptTemplate(
        id="lifestyle-kitchen",
        name="厨房/餐厅场景",
        description="适合食品、厨具、餐具类产品",
        prompt_template=(
            "Lifestyle food photography of {product}, on a marble kitchen countertop, "
            "morning sunlight streaming through window, fresh ingredients scattered naturally around, "
            "warm tones with golden hour lighting, shallow depth of field, "
            "editorial food magazine quality, appetizing and fresh appearance"
        ),
        aspect_ratio="3:4",
        tags=["食品", "厨房", "美食摄影"],
    ),
    ImagePromptTemplate(
        id="lifestyle-bathroom",
        name="卫浴/梳妆台场景",
        description="适合护肤品、化妆品、个护产品",
        prompt_template=(
            "Beauty product photography of {product}, arranged on a clean marble bathroom vanity, "
            "soft natural light, fresh flowers and white towels in background, "
            "spa-like serene atmosphere, elegant minimal composition, "
            "luxury skincare brand aesthetic, clean and refreshing mood"
        ),
        aspect_ratio="3:4",
        tags=["美妆", "护肤", "梳妆台"],
    ),
]

FLAT_LAY_SHOTS = [
    ImagePromptTemplate(
        id="flatlay-minimal",
        name="极简平铺",
        description="产品 + 少量配饰，整洁有设计感",
        prompt_template=(
            "Flat lay product photography of {product}, viewed from directly above, "
            "on a clean white marble surface, one or two minimal props (dried flower, ribbon), "
            "soft even lighting with no harsh shadows, editorial minimal aesthetic, "
            "high end catalog quality, perfect symmetry and spacing"
        ),
        aspect_ratio="1:1",
        tags=["平铺", "极简", "高级感"],
    ),
    ImagePromptTemplate(
        id="flatlay-seasonal",
        name="季节主题平铺",
        description="结合季节元素的平铺图，适合节日营销",
        prompt_template=(
            "Flat lay product photography of {product}, surrounded by {season} themed elements, "
            "overhead shot on textured wooden surface, warm seasonal lighting, "
            "carefully curated composition with natural props, "
            "Pinterest-worthy aesthetic, rich seasonal colors"
        ),
        aspect_ratio="1:1",
        tags=["平铺", "季节", "节日营销"],
    ),
    ImagePromptTemplate(
        id="flatlay-collection",
        name="系列产品平铺",
        description="展示产品系列/套装，适合组合装商品",
        prompt_template=(
            "Flat lay product photography of a collection of {product}, arranged in an artistic composition, "
            "overhead shot on concrete background, color-coordinated props, "
            "natural daylight, organized yet organic arrangement, "
            "brand catalog style, showcasing product variety"
        ),
        aspect_ratio="3:4",
        tags=["平铺", "系列", "组合"],
    ),
]

DETAIL_SHOTS = [
    ImagePromptTemplate(
        id="detail-texture",
        name="材质特写",
        description="近距离展示产品材质和纹理",
        prompt_template=(
            "Extreme close-up macro photography of {product}, focusing on surface texture and material quality, "
            "shallow depth of field with sharp focus on key detail, soft directional lighting highlighting texture, "
            "premium material feel visible, professional product detail shot, "
            "luxury quality perception"
        ),
        aspect_ratio="1:1",
        tags=["特写", "材质", "质感"],
    ),
    ImagePromptTemplate(
        id="detail-feature",
        name="功能特写",
        description="突出产品独特功能或设计细节",
        prompt_template=(
            "Close-up detail shot of {product}, highlighting the unique design feature, "
            "dramatic side lighting creating depth and dimension, dark out-of-focus background, "
            "technical precision aesthetic, product innovation showcase, "
            "Apple-style product detail photography"
        ),
        aspect_ratio="1:1",
        tags=["特写", "功能", "细节"],
    ),
    ImagePromptTemplate(
        id="detail-unboxing",
        name="开箱/拆解展示",
        description="展示产品包装和内部结构",
        prompt_template=(
            "Product unpacking photography of {product}, packaging opened to reveal product inside, "
            "all components neatly arranged on a clean surface, soft overhead and front lighting, "
            "premium unboxing experience aesthetic, clean and organized composition, "
            "tech reviewer style product showcase"
        ),
        aspect_ratio="3:4",
        tags=["开箱", "包装", "拆解"],
    ),
]

SOCIAL_SHOTS = [
    ImagePromptTemplate(
        id="social-xhs",
        name="小红书风格",
        description="适合小红书的真实分享感图片，暖色调，生活化",
        prompt_template=(
            "Realistic lifestyle photo of {product}, aesthetic and warm, "
            "warm afternoon sunlight from curtain-filtered window, cozy bedroom or cafe setting, "
            "shot on iPhone with natural colors, slightly warm white balance, "
            "Xiaohongshu blogger aesthetic, relatable and genuine feel, no obvious studio lighting"
        ),
        aspect_ratio="3:4",
        tags=["小红书", "真实感", "博主风"],
    ),
    ImagePromptTemplate(
        id="social-douyin",
        name="抖音/短视频封面",
        description="竖屏、视觉冲击力强，适合抖音视频封面",
        prompt_template=(
            "Eye-catching vertical product photo of {product}, dramatic contrast lighting, "
            "vibrant colors with high saturation, dynamic composition with product prominently featured, "
            "suitable for short video thumbnail, designed to stop scrolling, "
            "trending Douyin aesthetic, bold and energetic visual style"
        ),
        aspect_ratio="9:16",
        tags=["抖音", "封面", "视觉冲击"],
    ),
    ImagePromptTemplate(
        id="social-ins",
        name="Instagram/国际社媒",
        description="适合 Instagram、Pinterest 等国际平台",
        prompt_template=(
            "Instagram-worthy product photo of {product}, aesthetically pleasing composition, "
            "moody natural lighting with warm undertones, curated lifestyle setting, "
            "trending Instagram aesthetic 2025, beautifully styled with subtle props, "
            "desaturated pastel color palette, aspirational lifestyle imagery"
        ),
        aspect_ratio="1:1",
        tags=["Instagram", "国际", "INS风"],
    ),
]

# ── 平台默认尺寸 ──

PLATFORM_SIZES = {
    "xhs": "768*1024",       # 3:4 竖图
    "dy": "720*1280",         # 9:16 竖屏
    "amazon": "1024*1024",    # 1:1 方形
    "generic": "1024*1024",   # 默认方形
}

# ── 所有模板汇总 ──

ALL_TEMPLATES: list[ImagePromptTemplate] = (
    STUDIO_SHOTS + LIFESTYLE_SHOTS + FLAT_LAY_SHOTS + DETAIL_SHOTS + SOCIAL_SHOTS
)

TEMPLATES_BY_CATEGORY = {
    "studio": {"name": "棚拍白底", "templates": STUDIO_SHOTS},
    "lifestyle": {"name": "场景搭配", "templates": LIFESTYLE_SHOTS},
    "flatlay": {"name": "平铺展示", "templates": FLAT_LAY_SHOTS},
    "detail": {"name": "细节特写", "templates": DETAIL_SHOTS},
    "social": {"name": "社媒风格", "templates": SOCIAL_SHOTS},
}


def build_image_prompt(
    product: str,
    template_id: str | None = None,
    color: str = "soft pastel pink",
    season: str = "spring",
    custom_instruction: str = "",
) -> str:
    """构建最终发送给通义万相的 prompt。

    如果指定了 template_id，使用对应模板；否则用默认白底图。
    custom_instruction 会追加到 prompt 末尾作为额外约束。
    """
    if template_id:
        for t in ALL_TEMPLATES:
            if t.id == template_id:
                prompt = t.prompt_template.format(product=product, color=color, season=season)
                break
        else:
            prompt = STUDIO_SHOTS[0].prompt_template.format(product=product, color=color, season=season)
    else:
        prompt = STUDIO_SHOTS[0].prompt_template.format(product=product, color=color, season=season)

    if custom_instruction:
        prompt = f"{prompt}, {custom_instruction}"

    return prompt

"""知识库种子数据：预填三平台核心规则和运营知识"""
from app.workspace import KnowledgeSource, save_knowledge_source

SEED_DATA = [
    # === 小红书 ===
    {
        "title": "小红书内容审核红线",
        "source_type": "platform_rule",
        "platform": "xhs",
        "content": """小红书严格禁止以下内容：
1. 绝对化用语：最好、第一、顶级、万能、100%有效、根治、永不反弹
2. 虚假功效承诺：不能宣称产品有医疗效果、不能承诺具体使用结果
3. 硬广语气：不能出现"下单"、"购买链接"、"加微信"、"私聊"等导流词
4. 未标注的广告：推广内容必须标注"广告"或"合作"
5. 虚假使用体验：不能编造未亲身经历的使用感受
6. 价格诱导：不能用"限时"、"最后一天"等制造焦虑

安全表达方式：
- "我觉得" → "用了一周的感受是"
- "绝对好用" → "个人体验还不错"
- "买它" → "链接在主页"""},
    {
        "title": "小红书爆款笔记结构",
        "source_type": "platform_rule",
        "platform": "xhs",
        "content": """小红书高互动笔记的共同特征：

标题公式：
- 痛点+解决方案："干皮姐妹别划走！这个面膜救了我的换季脸"
- 数字+效果："用了7天，室友问我是不是偷偷去做了医美"
- 反差+好奇："9.9元的东西，比我200块的精华还好用"
- 身份+推荐："敏感肌10年，终于找到能用的面霜"

正文结构：
1. 开头：场景共鸣（1-2句，让读者代入）
2. 中间：使用体验+具体细节（时间线/对比/成分分析）
3. 结尾：总结推荐+互动引导

标签策略：
- 2个大流量词（#面膜推荐 #护肤分享）
- 2个精准长尾词（#干皮面膜 #换季护肤）
- 1个情绪词（#好物分享 #真心推荐）

发布时间：晚上8-10点流量最高，周末效果更好"""},
    {
        "title": "小红书SEO关键词策略",
        "source_type": "platform_rule",
        "platform": "xhs",
        "content": """小红书搜索排名影响因素：
1. 标题关键词：标题前15个字权重最高，核心词必须前置
2. 正文关键词：自然嵌入3-5个相关关键词，不要堆砌
3. 标签关键词：标签直接参与搜索匹配
4. 互动数据：点赞>收藏>评论，高互动内容排名靠前

关键词布局技巧：
- 核心词放标题（如"补水面膜"）
- 长尾词放正文（如"干皮补水面膜推荐"）
- 场景词放标签（如"换季护肤" "办公室补水"）
- 避免关键词重复：标题有"面膜"，正文可以用"面贴膜"替代"""},

    # === 抖音 ===
    {
        "title": "抖音短视频脚本规范",
        "source_type": "platform_rule",
        "platform": "dy",
        "content": """抖音短视频的核心是"前3秒留人"。

脚本结构（30秒标准）：
- 0-3秒 Hook：制造好奇/共鸣/冲突，阻止划走
  好的Hook："你知道吗？90%的人洗脸都洗错了"
  差的Hook："大家好，今天给大家推荐一个产品"
- 3-15秒 展示：场景化演示产品卖点，画面感要强
- 15-25秒 讲解：核心卖点+使用体验，语言口语化
- 25-30秒 转化：自然引导，不硬推

分镜标注要求：
- 每个分镜标注时长范围
- 描述画面内容（镜头角度、动作、表情）
- 标注口播/旁白文字
- 标注BGM情绪"""},
    {
        "title": "抖音违禁词和审核规则",
        "source_type": "platform_rule",
        "platform": "dy",
        "content": """抖音严格禁止：
1. 绝对化用语：最、第一、顶级、万能、永远
2. 虚假宣传：夸大功效、编造数据、伪造认证
3. 导流行为：出现微信号、二维码、外部链接
4. 低俗内容：擦边、暗示、不当用语
5. 未标注广告：商业推广必须标注"广告"

安全表达：
- "全网最低" → "性价比很高"
- "绝对有效" → "我个人体验有改善"
- "下单" → "点击小黄车"
- "加微信" → "关注我，私信回复"""},
    {
        "title": "抖音算法和发布时间",
        "source_type": "platform_rule",
        "platform": "dy",
        "content": """抖音推荐算法核心指标：
1. 完播率：最重要的指标，视频被看完的比例
2. 点赞率：点赞数/播放数
3. 评论率：评论数/播放数
4. 转发率：转发数/播放数
5. 关播率：看完后关注的比例

最佳发布时间：
- 工作日：12:00-13:00（午休）、18:00-20:00（下班）、21:00-23:00（睡前）
- 周末：10:00-12:00、14:00-16:00、20:00-23:00
- 不同品类有差异：美妆类晚上好，知识类中午好

提升完播率的技巧：
- 前3秒必须抓人
- 视频节奏紧凑，不要拖沓
- 结尾留悬念或反转
- 控制时长：新号建议15-30秒"""},

    # === Amazon ===
    {
        "title": "Amazon Listing优化规范",
        "source_type": "platform_rule",
        "platform": "amazon",
        "content": """Amazon Listing结构要求：

Title（标题）：
- 200字符以内
- 结构：Brand + Core Keyword + Main Feature + Size/Spec
- 关键词前置，最重要的信息放最前面
- 避免关键词堆砌，保持可读性
- 示例："BrandX Insulated Water Bottle 500ml - Stainless Steel, BPA Free, Keeps Drinks Hot 12hrs Cold 24hrs"

Bullet Points：
- 5条，每条聚焦一个核心卖点
- 首字母大写，每条150-200字符
- 结构：Feature → Benefit → Use Case
- 用场景化语言描述benefit，不要只说feature
- 避免促销信息（"SALE"、"LIMITED TIME"）

Description：
- 2000字符以内
- 品牌故事 + 使用场景 + 技术细节
- 自然嵌入长尾关键词
- 使用HTML标签增强可读性（<b>、<br>）"""},
    {
        "title": "Amazon SEO关键词策略",
        "source_type": "platform_rule",
        "platform": "amazon",
        "content": """Amazon A9算法排名因素：
1. 相关性：标题、Bullet Points、Description中的关键词匹配度
2. 销量：近期销量和销售速度
3. 转化率：点击后购买的比例
4. 评论：数量和评分

关键词布局：
- Title：放最重要的2-3个核心关键词
- Bullet Points：放长尾关键词和场景关键词
- Backend Search Terms：250字符，放标题和BP中没出现的关键词
- Description：自然嵌入补充关键词

避免：
- 关键词堆砌（影响可读性和转化率）
- 使用竞品品牌名（违规）
- 全大写（Amazon禁止）
- 促销信息在标题中"""},
    {
        "title": "Amazon常见违规和处罚",
        "source_type": "platform_rule",
        "platform": "amazon",
        "content": """Amazon Listing常见违规：

1. 关键词堆砌：标题重复同一关键词多次 → 降低排名甚至下架
2. 虚假宣传：夸大功效、伪造认证 → Listing下架、账号警告
3. 促销信息：标题中出现"SALE"、"50% OFF" → 违反政策
4. 全大写：标题全大写 → 违反格式规范
5. 竞品品牌名：在关键词中使用竞品品牌 → 侵权投诉
6. 图片违规：主图不是白底产品图 → Listing降权

安全做法：
- 所有功效声明必须有依据
- 使用"may help"、"designed to"等软化表达
- 避免"guaranteed"、"miracle"、"cure"等绝对化用语
- 标题保持专业、可读、信息密集"""},

    # === 通用运营知识 ===
    {
        "title": "电商内容创作通用原则",
        "source_type": "platform_rule",
        "platform": None,
        "content": """跨平台内容创作核心原则：

1. 场景化表达：不说"补水效果好"，说"敷完第二天上妆不卡粉"
2. 痛点共鸣：开头让目标用户觉得"说的就是我"
3. 社会证明：引用真实数据、用户反馈、第三方认证
4. 自然转化：不硬推，让用户觉得是自己想买的
5. 视觉优先：内容配图/视频比文字更重要

卖点表达公式：
Feature（特点）→ Advantage（优势）→ Benefit（利益）
例：3mm超薄（特点）→ 比普通款薄50%（优势）→ 穿紧身裤完全无痕（利益）

禁忌词通用列表：
最好、最佳、第一、顶级、极致、绝对、万能、100%、纯天然、零添加、无副作用、根治、药到病除、永不反弹、一次见效"""},
]

def seed_knowledge():
    """Seed the knowledge base with platform rules."""
    count = 0
    for item in SEED_DATA:
        source = KnowledgeSource(
            id=f"seed_{item['platform'] or 'general'}_{count}",
            title=item["title"],
            source_type=item["source_type"],
            platform=item["platform"],
            content=item["content"],
            url="",
        )
        save_knowledge_source(source)
        count += 1
    print(f"Seeded {count} knowledge sources.")

if __name__ == "__main__":
    seed_knowledge()

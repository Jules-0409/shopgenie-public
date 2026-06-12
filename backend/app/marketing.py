"""电商营销日历与选题推荐。"""
from dataclasses import dataclass

@dataclass
class MarketingNode:
    id: str
    name: str
    date_range: str
    description: str
    platforms: list[str]
    topics: list[str]

# 静态营销日历数据集
MARKETING_EVENTS = [
    {
        "id": "queen-day",
        "name": "38 女神节",
        "date_range": "03-01 至 03-08",
        "description": "春季电商开门红，以女性悦己、美妆服饰、生活好物为主战场。",
        "platforms": ["xhs", "dy"],
        "topics_by_category": {
            "美妆": [
                "送给最爱的自己！女神节高颜值美妆礼盒开箱",
                "抗初老第一支精华，女王节送自己一份独一无二的底气",
                "春日浪漫桃花妆！约会出街必备彩妆合集"
            ],
            "数码": [
                "高颜值办公好物！送给职场女生的数码单品推荐",
                "粉嫩少女心数码配件，几十块提升桌面幸福感",
                "轻薄又好用！适合都市通勤女生的降噪耳机推荐"
            ],
            "食品": [
                "女王节低卡下午茶推荐，解馋抗糖不长胖！",
                "高颜值健康花草茶，喝出红润好气色",
                "女神节限时零食礼盒，送闺蜜的甜蜜首选"
            ],
            "服饰": [
                "早春温柔风穿搭！女神节必入的法式针织衫",
                "职场大女主穿搭，通勤干练又不失温柔的搭配公式",
                "春季第一双高跟鞋，好看好穿不累脚强推"
            ]
        },
        "default_topics": [
            "女神节自用省钱好物避雷与回购指南",
            "提升生活幸福感的春日好物公开分享",
            "送礼不踩坑！女神节高分浪漫礼盒推荐"
        ]
    },
    {
        "id": "mother-day",
        "name": "母亲节",
        "date_range": "05-01 至 05-12",
        "description": "温馨感恩节点，主打健康保健、养生足浴、成熟女装与心意礼盒。",
        "platforms": ["xhs", "dy", "amazon"],
        "topics_by_category": {
            "美妆": [
                "送妈妈的抗衰老护肤清单，留住她的年轻时光",
                "母亲节送礼首选！高档贵妇抗皱面霜真实测评",
                "适合成熟女性的日常低调口红色号推荐"
            ],
            "数码": [
                "送长辈的数码好物！屏幕大、续航久的智能手环/手表推荐",
                "教妈妈用智能家居！这三款扫地机器人/洗地机最省心",
                "老年人拍照神器！拍照好看、操作简单的千元拍照手机"
            ],
            "食品": [
                "母亲节送妈妈的无糖滋补燕窝礼盒，健康又养颜",
                "养生党妈妈最爱！高品质黑芝麻丸与红豆薏米粉推荐",
                "低糖健康糕点，配花茶正合适，送给妈妈的下午茶"
            ],
            "服饰": [
                "母亲节送妈妈的桑蚕丝丝巾，百搭优雅又有质感",
                "适合 50+ 妈妈的中年优雅改良旗袍/日常连衣裙穿搭",
                "给妈妈买鞋必看！平底舒适防滑健步鞋强推"
            ]
        },
        "default_topics": [
            "母亲节送礼不踩坑！实用健康好物排行榜",
            "亲手为妈妈准备的节日惊喜好物推荐",
            "百元到千元预算，母亲节送妈妈的贴心礼物清单"
        ]
    },
    {
        "id": "promotion-618",
        "name": "618 年中大促",
        "date_range": "06-01 至 06-20",
        "description": "全年首个特大促销节点，全品类商家爆量突破的黄金期。",
        "platforms": ["xhs", "dy", "amazon"],
        "topics_by_category": {
            "美妆": [
                "618 终极省钱囤货清单：这几款美妆好物回购无数次！",
                "夏日控油持妆救星，618 闭眼囤这套底妆",
                "掏心窝分享！换季急救维稳的宝藏精华真实推荐"
            ],
            "数码": [
                "618 避坑指南：学生党千元生产力平板怎么选？",
                "数码发烧友狂喜！618 最值入手的数码配件单品",
                "打造极简高颜值桌面！这几款高性价比数码单品强推"
            ],
            "食品": [
                "618 办公室健康零食囤货指南，低卡解馋吃不胖！",
                "无限回购！618 必成箱囤的高颜值果汁/气泡水",
                "熬夜看剧必备小零食清单，618 凑单闭眼入"
            ],
            "服饰": [
                "618 换季衣橱大洗牌！这 5 件百搭法式短袖绝美",
                "超显瘦显高穿搭！618 必入的小个子夏装避坑",
                "平价夏日穿搭分享：618 几百块搞定一星期出街搭配"
            ]
        },
        "default_topics": [
            "618 终极省钱囤货清单，超高性价比避坑指南！",
            "错过等半年！618 必买的高口碑生活好物推荐",
            "好物评测分享：今年 618 哪些东西买得最值？"
        ]
    },
    {
        "id": "back-to-school",
        "name": "开学季",
        "date_range": "08-20 至 09-05",
        "description": "学生与年轻群体开学采购期，主打宿舍寝具、学习数码、文具、防晒急救等。",
        "platforms": ["xhs", "dy", "amazon"],
        "topics_by_category": {
            "美妆": [
                "早八人 3 分钟伪素颜底妆，宿舍党开学清爽必备",
                "百元预算！适合学生党的平价好用护肤品全套推荐",
                "开学军训防晒急救包，晒不黑的秘密都在这"
            ],
            "数码": [
                "大学新生宿舍必备数码清单，第一款每个宿舍都需要",
                "千元预算！适合大学生网课与自习的头戴降噪耳机推荐",
                "百元预算提升宿舍生活品质 of 数码好物强推"
            ],
            "食品": [
                "开学宿舍必备干粮合集，半夜解馋泡面平替",
                "学生党宿舍平价神仙零食，好吃不贵成箱买！",
                "军训能量补充包！方便携带的低糖高能量零食"
            ],
            "服饰": [
                "早八人活力穿搭，开学季重返 18 岁的元气搭配秘籍",
                "军训结束穿什么？元气少女秋季开学日常穿搭模板",
                "百元搞定宿舍穿搭！平价又舒适的高颜值卫衣合集"
            ]
        },
        "default_topics": [
            "迎接新学期！学生党必备平价好用生活好物清单",
            "开学季宿舍好物分享，让你幸福感瞬间爆棚",
            "百元预算！开学必入的高颜值实用学习神器"
        ]
    },
    {
        "id": "promotion-1111",
        "name": "双 11 狂欢节",
        "date_range": "11-01 至 11-12",
        "description": "年度力度最大、交易量最高的特大促销节点，冬季囤货主战场。",
        "platforms": ["xhs", "dy", "amazon"],
        "topics_by_category": {
            "美妆": [
                "双 11 空瓶记：这 5 款宝藏单品必须囤双份锁死！",
                "熬夜修护不垮脸，双 11 熬夜党必备高能面霜",
                "美妆博主双 11 真实测评，年度好物避雷不踩坑！"
            ],
            "数码": [
                "年度数码大盘点：双 11 闭眼入的性价比电脑外设",
                "生产力工具推荐！双 11 程序员/自媒体必备办公好物",
                "旧手机卡顿？双 11 最实用智能手机换机避坑指南"
            ],
            "食品": [
                "双 11 吃货狂欢：百元吃出幸福感的国货零食大礼包",
                "囤货预警！双 11 必须成箱买的低脂饱腹代餐代餐",
                "手慢无！双 11 必抢的网红爆款零食横向实测"
            ],
            "服饰": [
                "双 11 抗寒大作战！暖和又不臃肿的冬日羽绒服推荐",
                "秋日第一件羊绒针织衫，双 11 温柔风穿搭模板",
                "双 11 避坑防雷：这几款衣服千万不要加购物车！"
            ]
        },
        "default_topics": [
            "双 11 狂欢夜，这几款必买爆款好物一键加购！",
            "年度最值得入手单品，双 11 错过再等一整年",
            "理性剁手避坑指南！双 11 哪些东西真的不建议买？"
        ]
    },
    {
        "id": "black-friday",
        "name": "黑色星期五 (Black Friday)",
        "date_range": "11-23 至 11-30",
        "description": "海外黑五大促，跨境电商与独立站流量及销量的年度巅峰。",
        "platforms": ["amazon"],
        "topics_by_category": {
            "数码": [
                "Best Tech Deals for Black Friday: Must-Have Gadgets 2026",
                "Upgrade Your WFH Setup: Best Budget Ergonomic Keyboards & Mouse",
                "Top Smart Home Devices to Grab This Black Friday Under $100"
            ],
            "美妆": [
                "Black Friday Beauty Haul: Anti-Aging Skincare Must-Buys",
                "Top Gift Sets for Her: Luxury Cosmetics Under $50 on Amazon",
                "Cruelty-Free Skincare Essentials to Stock Up This Holiday Season"
            ]
        },
        "default_topics": [
            "Top Black Friday Amazon Deals You Can't Miss This Year",
            "Holiday Gift Guide: Best Value Products to Grab This Friday",
            "Black Friday Shopper's Guide: How to Get the Best Bargains"
        ]
    },
    {
        "id": "christmas-holiday",
        "name": "圣诞礼遇季",
        "date_range": "12-15 至 12-25",
        "description": "岁末双旦礼遇，以精美礼盒、节日装扮、送礼仪式感为核心选题。",
        "platforms": ["xhs", "dy", "amazon"],
        "topics_by_category": {
            "美妆": [
                "圣诞心意礼盒！送女友绝对夸的高颜值彩妆限定",
                "节日氛围感红唇妆容！圣诞聚会出街吸睛妆容推荐",
                "圣诞倒数日历拆箱：今年最值得入手的美妆盲盒"
            ],
            "数码": [
                "送男生的圣诞礼物！高逼格极客数码配件好物推荐",
                "百元预算的圣诞数码礼盒，实用又有科技感",
                "圣诞节拍照必备！高氛围感便携式口袋云台相机"
            ],
            "食品": [
                "圣诞姜饼人与限定草莓热红酒，节日感拉满的圣诞美食",
                "高颜值圣诞巧克力礼盒，送朋友/同事的暖心之选",
                "圣诞烘焙好物分享：亲手做一份有温度的节日蛋糕"
            ],
            "服饰": [
                "圣诞红绿氛围感穿搭！吸睛又日常的圣诞红卫衣/绿毛衣",
                "圣诞约会温婉穿搭，暖和又上镜的冬日大衣内搭",
                "圣诞节送闺蜜的毛绒暖手宝/高质感围巾推荐"
            ]
        },
        "default_topics": [
            "圣诞送礼不踩坑！送闺蜜/送另一半的仪式感好物清单",
            "氛围感拉满的圣诞居家装饰好物，几十块打造节日温暖",
            "圣诞限定好礼大公开！高颜值高口碑礼物精心挑选"
        ]
    }
]

def get_topics_for_event(event_data: dict, category: str | None) -> list[str]:
    if not category:
        return event_data["default_topics"]
    
    topics_by_category = event_data.get("topics_by_category", {})
    matched_topics = []
    
    # 简单模糊匹配品类名称
    for key, topics in topics_by_category.items():
        if key in category or category in key:
            matched_topics = topics
            break
            
    if not matched_topics:
        return event_data["default_topics"]
    return matched_topics

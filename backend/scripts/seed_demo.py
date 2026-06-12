"""Demo 数据种子：一条命令把每个页面灌满，用于演示与截图。

用法（在 backend/ 目录下）：
    .venv/bin/python scripts/seed_demo.py --force          # 清空业务数据后写入演示数据
    .venv/bin/python scripts/seed_demo.py --db /tmp/x.db   # 写到指定库（不动默认库）

写入内容：品牌档案、3 个商品（含评论洞察）、5 条内容资产、带涨跌趋势的效果数据、
一个已决出赢家的 A/B 实验 + 一个样本不足的实验、一条触发回填提醒的排期资产。
全部数据明确标注 demo 来源（notes 字段），与质量铁律不冲突：它不混进真实回流，
而是给空库一个可演示的起点。
"""
import argparse
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.memory as memory  # noqa: E402


def iso_days_ago(days: int) -> str:
    return (datetime.now(UTC) - timedelta(days=days)).isoformat()


def main() -> None:
    parser = argparse.ArgumentParser(description="ShopGenie demo 数据种子")
    parser.add_argument("--db", type=Path, default=None, help="目标数据库路径（默认 app/shopgenie.db）")
    parser.add_argument("--force", action="store_true", help="清空已有业务数据后写入")
    args = parser.parse_args()

    if args.db:
        memory.DB_PATH = args.db

    # 在 DB_PATH 确定之后再导入业务模块
    from app.memory import UserProfile, save_profile
    from app.schemas import ContentSection, GeneratedContent, Platform
    from app.workspace import (
        Experiment,
        PerformanceRecord,
        Product,
        create_content_asset,
        list_products,
        save_content_asset,
        save_experiment,
        save_performance,
        save_product,
    )

    if list_products():
        if not args.force:
            print("数据库已有商品数据。确认要覆盖请加 --force（会清空业务表）。")
            sys.exit(1)
        import sqlite3
        conn = sqlite3.connect(str(memory.DB_PATH))
        for table in ("products", "content_assets", "content_versions", "performance_records", "experiments", "operations_actions", "user_profile"):
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
        conn.close()
        print("已清空业务表。")

    # ── 品牌档案 ──
    save_profile(UserProfile(
        brand_name="山岚生活",
        category="家居好物",
        target_audience="25-35 岁城市通勤人群",
        tone="真实、克制、有生活气",
        style_preferences=["口语化", "场景代入", "不夸大功效"],
        platforms=["xhs", "dy"],
        taboo_words=["最", "第一", "绝对"],
    ))

    # ── 商品（含评论洞察，洞察必须携带 product_id 才会注入生成）──
    cup = save_product(Product(
        name="轻量钛保温杯 350ml",
        category="家居好物",
        audience="通勤族、学生党",
        selling_points=["杯身 138g 全网最轻档位", "单手开盖", "保温 6 小时保冷 12 小时"],
        facts=["容量 350ml", "杯身钛合金 138g", "口径 4.2cm", "保温实测 55°C/6h"],
        prohibited_claims=["永不烫嘴", "保温 24 小时"],
        notes="秋冬通勤场景主推",
    ))
    cup.review_insights = {
        "product_id": cup.id, "product_name": cup.name, "review_count": 86,
        "loved_points": ["轻到没有负重感，通勤包里随手放", "单手开盖等红灯也能喝", "杯口不挂嘴，不烫"],
        "pain_points": ["350ml 对水量大的人偏小", "浅色杯身容易留指纹"],
        "avoid_phrases": ["全天保温", "永不漏水"],
        "voice_quotes": ["地铁上单手就能拧开，真的方便", "比我之前的杯子轻了一半都不止"],
        "summary": "轻和单手开盖是真实口碑点，容量偏小是主要顾虑",
    }
    save_product(cup)

    mask = save_product(Product(
        name="玻尿酸补水面膜",
        category="护肤",
        audience="干皮、混干皮",
        selling_points=["三重玻尿酸", "敷完不假滑", "上妆不卡粉"],
        facts=["25ml/片", "备案号可查", "无酒精无香精"],
        prohibited_claims=["医美级", "七天美白"],
    ))
    mouse = save_product(Product(
        name="超薄金属无线鼠标",
        category="数码配件",
        audience="移动办公人群",
        selling_points=["9.8mm 超薄", "双模连接", "静音微动"],
        facts=["厚度 9.8mm", "重量 58g", "Type-C 充电", "蓝牙 + 2.4G"],
        prohibited_claims=["终身质保"],
    ))

    def content(platform: Platform, title: str, body: str, tags: list[str]) -> GeneratedContent:
        return GeneratedContent(platform=platform, title=title, body=body, tags=tags,
                                sections=[ContentSection(label="正文", content=body)])

    # ── 内容资产 ──
    body_cup = "通勤包越换越小，杯子也得跟着减负。这只钛杯 138g，比手机还轻，装满水放包里完全没有坠感。\n\n早高峰挤地铁，单手拧开喝一口再塞回去，全程不用找地方放包。保温实测早上 8 点的热水，下午 2 点还是温的，适合不喝烫水的人。\n\n容量 350ml 适合办公室场景，水量大的姐妹可以等大杯版。" * 1
    a_cup, _ = create_content_asset(content(Platform.XHS, "比手机还轻的保温杯，通勤包终于减负了", body_cup, ["通勤好物", "保温杯推荐", "上班族日常"]), cup.id, change_note="demo 种子")
    a_cup2, _ = create_content_asset(content(Platform.DOUYIN, "你的保温杯为什么越用越少拿？", "【0-3秒】画面：通勤包倒出三斤重的杯子。口播：你的保温杯是不是也在家吃灰？\n【3-12秒】画面：手掌托起钛杯，单手开盖。口播：138 克，比手机轻，单手就能开。\n【12-15秒】口播：链接在下方，通勤族冲。", ["通勤好物", "保温杯"]), cup.id, change_note="demo 种子")
    a_mask, _ = create_content_asset(content(Platform.XHS, "干皮姐妹的换季急救：敷完不假滑的补水面膜", "换季脸干起皮，上妆全是卡纹。这片面膜敷 15 分钟，精华不黏不假滑，第二天上妆服帖很多。\n\n无酒精无香精，敏感期也敢用。一周两三次，别天天敷。", ["补水面膜", "干皮护肤", "换季护肤"]), mask.id, change_note="demo 种子")
    a_mouse, _ = create_content_asset(content(Platform.AMAZON, "Ultra-Slim Wireless Mouse, 9.8mm Aluminum, Dual Mode", "SLIM & LIGHT — 9.8mm thin, 58g, slides into any laptop sleeve.\nDUAL MODE — Bluetooth + 2.4G receiver, switch between two devices.\nSILENT CLICKS — quiet micro switches for shared offices.\nTYPE-C FAST CHARGE — 2 hours use from a 1-minute charge.", ["wireless mouse", "slim mouse"]), mouse.id, change_note="demo 种子")
    # 排期 5 天前、无回流 → 触发"回填提醒"
    a_pending, _ = create_content_asset(content(Platform.XHS, "办公桌面的极简改造：一只超薄鼠标开始", "桌面好物分享：9.8mm 的鼠标和键盘叠在一起带走，移动办公轻装上阵。", ["桌面好物", "极简办公"]), mouse.id, change_note="demo 种子")
    a_pending.scheduled_at = iso_days_ago(5)
    save_content_asset(a_pending)

    # ── 效果数据（带趋势：保温杯笔记 CTR 前高后低 → 触发下滑告警）──
    perf = [
        # 保温杯小红书：8-12 天前 CTR ~4.2%，最近 3 天 CTR ~1.6% → 下滑
        PerformanceRecord(asset_id=a_cup.id, platform="xhs", impressions=5200, clicks=218, orders=16, conversions=16, revenue=2064.0, ad_spend=150.0, notes="demo：首周投放", recorded_at=iso_days_ago(9)),
        PerformanceRecord(asset_id=a_cup.id, platform="xhs", impressions=4800, clicks=78, orders=5, conversions=5, refunds=0, revenue=645.0, ad_spend=140.0, notes="demo：次周投放", recorded_at=iso_days_ago(2)),
        # 抖音脚本：点击成规模但转化低 → 低转化建议
        PerformanceRecord(asset_id=a_cup2.id, platform="dy", impressions=12600, clicks=520, orders=6, conversions=6, revenue=774.0, ad_spend=420.0, notes="demo：信息流测试", recorded_at=iso_days_ago(3)),
        # 面膜：健康数据
        PerformanceRecord(asset_id=a_mask.id, platform="xhs", impressions=3400, clicks=176, orders=12, conversions=12, revenue=708.0, ad_spend=90.0, notes="demo：自然流量", recorded_at=iso_days_ago(4)),
        # 鼠标 Amazon：曝光高 CTR 低于基准
        PerformanceRecord(asset_id=a_mouse.id, platform="amazon", impressions=8900, clicks=31, orders=9, conversions=9, revenue=1791.0, ad_spend=260.0, notes="demo：关键词广告", recorded_at=iso_days_ago(5)),
    ]
    for record in perf:
        save_performance(record)

    # ── A/B：一个已决出（样本足额），一个进行中（样本不足）──
    save_experiment(Experiment(
        product_id=cup.id, platform="xhs", name="保温杯标题钩子竞速", brief="主打轻量 vs 主打单手开盖",
        variants=[
            {"label": "A", "title": "比手机还轻的保温杯，通勤包终于减负了", "hook": "通勤包越换越小，杯子也得跟着减负", "angle": "痛点", "impressions": 1450, "clicks": 92, "conversions": 11},
            {"label": "B", "title": "等红灯也能喝水：单手开盖保温杯", "hook": "骑车党的痛只有骑车党懂", "angle": "场景", "impressions": 1380, "clicks": 61, "conversions": 4},
            {"label": "C", "title": "138g 钛杯实测：保温 6 小时是真的吗", "hook": "我拿温度计测了一整天", "angle": "测评", "impressions": 1410, "clicks": 84, "conversions": 7},
        ],
        status="decided", winner_label="A",
        confidence_level="ready", confidence_message="每个变体均超过最小样本量，按转化率判定",
    ))
    save_experiment(Experiment(
        product_id=mask.id, platform="xhs", name="面膜开头钩子测试", brief="焦虑型 vs 干货型开头",
        variants=[
            {"label": "A", "title": "换季烂脸自救指南", "hook": "脸干到起皮的看过来", "angle": "痛点", "impressions": 120, "clicks": 9, "conversions": 1},
            {"label": "B", "title": "成分党拆解：三重玻尿酸怎么选", "hook": "先看备案再看广告", "angle": "干货", "impressions": 95, "clicks": 6, "conversions": 0},
        ],
        status="running",
    ))

    print(f"完成：3 商品 / 5 内容资产 / {len(perf)} 条效果数据 / 2 个 A/B 实验 → {memory.DB_PATH}")
    from app.operations import build_operations_brief
    brief = build_operations_brief()
    print(f"指挥台自检：status={brief['status']}，{len(brief['actions'])} 条建议")
    for action in brief["actions"]:
        print(f"  [{action['priority']}] {action['title']}（{action['metric']}）")


if __name__ == "__main__":
    main()

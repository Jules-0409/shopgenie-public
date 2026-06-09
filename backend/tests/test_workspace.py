from pathlib import Path

import app.memory as memory
from app.schemas import ContentSection, GeneratedContent, Platform
from app.workspace import (
    KnowledgeSource,
    PerformanceRecord,
    Product,
    add_content_version,
    build_performance_insights,
    create_agent_task,
    create_content_asset,
    evaluate_quality,
    list_agent_tasks,
    list_content_versions,
    list_knowledge_sources,
    list_performance,
    list_products,
    save_knowledge_source,
    save_performance,
    save_product,
)
from app.workspace_context import build_knowledge_prompt, build_performance_prompt, build_product_prompt, learn_product_from_message, retrieve_knowledge


def use_db(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"


def content(body: str = "这是一段足够长的正文，包含使用场景、商品卖点和自然表达。" * 3) -> GeneratedContent:
    return GeneratedContent(
        platform=Platform.XHS,
        title="真实使用分享",
        body=body,
        tags=["家居好物", "使用分享", "生活方式"],
        sections=[ContentSection(label="正文", content=body)],
    )


def test_product_round_trip_and_prompt(tmp_path: Path) -> None:
    use_db(tmp_path)
    product = save_product(Product(name="轻量保温杯", category="家居", facts=["容量 500ml"], selling_points=["轻量"]))

    assert list_products()[0].name == "轻量保温杯"
    assert "容量 500ml" in build_product_prompt(product)


def test_product_learns_only_explicit_facts(tmp_path: Path) -> None:
    use_db(tmp_path)
    product = save_product(Product(name="轻量保温杯"))
    learned = learn_product_from_message(product, "事实：容量 500ml、杯身 230g\n卖点：单手开盖\n帮我写一篇笔记")

    assert learned.facts == ["容量 500ml", "杯身 230g"]
    assert learned.selling_points == ["单手开盖"]
    assert "帮我写一篇笔记" not in learned.facts


def test_quality_flags_placeholders_and_prohibited_claims(tmp_path: Path) -> None:
    use_db(tmp_path)
    product = save_product(Product(name="面膜", prohibited_claims=["根治"]))
    report = evaluate_quality(content("根治干燥问题，[待补充:成分]"), product)

    assert report.score < 100
    assert any("禁用声明" in suggestion for suggestion in report.suggestions)
    assert any("待补充" in suggestion for suggestion in report.suggestions)


def test_quality_flags_unverified_numeric_claim(tmp_path: Path) -> None:
    use_db(tmp_path)
    product = save_product(Product(name="保温杯", facts=["容量 500ml"]))
    report = evaluate_quality(content("容量 500ml，保温 48 小时。" * 8), product)

    assert any(check["name"] == "事实一致性" and not check["passed"] for check in report.checks)
    assert any("规格数字" in suggestion for suggestion in report.suggestions)


def test_content_asset_keeps_versions(tmp_path: Path) -> None:
    use_db(tmp_path)
    asset, first = create_content_asset(content(), change_note="AI 初稿")
    second = add_content_version(asset.id, content("这是人工修改后的正文。" * 10), "增强场景感")

    versions = list_content_versions(asset.id)
    assert first.version == 1
    assert second.version == 2
    assert [version.version for version in versions] == [2, 1]


def test_knowledge_task_and_performance_round_trip(tmp_path: Path) -> None:
    use_db(tmp_path)
    save_knowledge_source(KnowledgeSource(title="小红书规则", platform="xhs", content="避免硬广"))
    task = create_agent_task("生成新品种草内容")
    metric = save_performance(PerformanceRecord(asset_id="content_1", platform="xhs", impressions=100, conversions=3))

    assert "避免硬广" in build_knowledge_prompt(Platform.XHS)
    assert list_knowledge_sources()[0].title == "小红书规则"
    assert list_agent_tasks()[0].id == task.id
    assert list_performance()[0].id == metric.id
    assert build_performance_insights()["conversion_rate"] == 3.0


def test_knowledge_retrieval_prefers_relevant_source(tmp_path: Path) -> None:
    use_db(tmp_path)
    save_knowledge_source(KnowledgeSource(title="Amazon 标题规则", platform="amazon", content="Title should stay concise"))
    save_knowledge_source(KnowledgeSource(title="Amazon 图片规则", platform="amazon", content="Main image background"))

    sources = retrieve_knowledge(Platform.AMAZON, "帮我检查 Amazon 标题")

    assert sources[0].title == "Amazon 标题规则"


def test_performance_prompt_feeds_back_product_results(tmp_path: Path) -> None:
    use_db(tmp_path)
    product = save_product(Product(name="保温杯"))
    asset, _ = create_content_asset(content(), product.id)
    save_performance(PerformanceRecord(asset_id=asset.id, platform="xhs", impressions=1000, conversions=25))

    prompt = build_performance_prompt(product.id, Platform.XHS)

    assert "历史发布效果" in prompt
    assert "转化率 2.5%" in prompt

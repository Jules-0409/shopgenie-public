from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.memory as memory
from app.deepseek import DeepSeekClient, DeepSeekError
from app.main import app
from app.review_mining import analyze_reviews, normalize_insights
from app.workspace import Product
from app.workspace_context import build_product_prompt, build_review_prompt

RAW_LLM = {
    "loved_points": ["敷完第二天上妆不卡粉", "敷完第二天上妆不卡粉", "保湿很顶", ""],
    "pain_points": ["瓶口设计容易洒"],
    "avoid_phrases": ["医美级"],
    "voice_quotes": ["回购第三次了", "学生党也买得起"],
    "summary": "保湿和性价比是核心卖点，注意瓶口体验",
}


def test_normalize_insights_dedupes_and_counts() -> None:
    out = normalize_insights(RAW_LLM, review_count=12)
    assert out["loved_points"] == ["敷完第二天上妆不卡粉", "保湿很顶"]  # 去重 + 去空
    assert out["pain_points"] == ["瓶口设计容易洒"]
    assert out["review_count"] == 12
    assert out["summary"].startswith("保湿和性价比")


def test_build_review_prompt_empty_when_no_insights() -> None:
    assert build_review_prompt(Product(name="测试")) == ""
    assert build_review_prompt(None) == ""


def test_build_product_prompt_injects_review_insights() -> None:
    product = Product(name="补水面膜", category="护肤")
    product.review_insights = {
        **normalize_insights(RAW_LLM, 12),
        "product_id": product.id,
        "product_name": product.name,
    }
    prompt = build_product_prompt(product)
    assert f"【当前商品评论洞察：{product.name}】" in prompt
    assert "敷完第二天上妆不卡粉" in prompt  # loved point 注入
    assert "瓶口设计容易洒" in prompt        # pain point 注入
    assert "回购第三次了" in prompt          # voice quote 注入


def test_build_product_prompt_rejects_review_insights_from_another_product() -> None:
    product = Product(name="保温杯", review_insights={
        **normalize_insights(RAW_LLM, 12),
        "product_id": "another_product",
        "product_name": "补水面膜",
    })

    prompt = build_product_prompt(product)

    assert "敷完第二天上妆不卡粉" not in prompt
    assert "当前商品评论洞察" not in prompt


@pytest.mark.asyncio
async def test_analyze_reviews_normalizes(monkeypatch) -> None:
    async def fake_complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        assert "买家评价" in user_prompt
        return RAW_LLM

    monkeypatch.setattr(DeepSeekClient, "complete_json", fake_complete_json)
    from app.config import Settings

    insights = await analyze_reviews("评论1\n评论2\n评论3", Settings(deepseek_api_key="x"))
    assert insights["loved_points"] == ["敷完第二天上妆不卡粉", "保湿很顶"]
    assert insights["review_count"] == 3


@pytest.mark.asyncio
async def test_analyze_reviews_rejects_empty() -> None:
    from app.config import Settings

    with pytest.raises(ValueError):
        await analyze_reviews("   ", Settings(deepseek_api_key="x"))


def test_review_api_flow(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "reviews.db"

    async def fake_complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        return RAW_LLM

    monkeypatch.setattr(DeepSeekClient, "complete_json", fake_complete_json)

    with TestClient(app) as client:
        product = client.post("/api/products", json={"name": "补水面膜", "category": "护肤"}).json()
        pid = product["id"]

        analyzed = client.post(f"/api/products/{pid}/reviews/analyze", json={"reviews": "好用\n回购\n保湿顶"})
        assert analyzed.status_code == 200
        insights = analyzed.json()["review_insights"]
        assert insights["loved_points"] == ["敷完第二天上妆不卡粉", "保湿很顶"]
        assert insights["product_id"] == pid
        assert insights["product_name"] == "补水面膜"

        # 普通更新商品不应抹掉评论洞察
        updated = client.put(f"/api/products/{pid}", json={"name": "补水面膜 Pro", "category": "护肤"})
        assert updated.json()["review_insights"]["review_count"] == 3

        cleared = client.delete(f"/api/products/{pid}/reviews")
        assert cleared.json()["review_insights"] is None

        missing = client.post("/api/products/nope/reviews/analyze", json={"reviews": "x"})
        assert missing.status_code == 404

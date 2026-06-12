from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.memory as memory
from app.config import Settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.main import app
from app.ab_testing import generate_variants
from app.schemas import Platform
from app.workspace import Experiment, compute_winner
from app.workspace_context import build_experiment_prompt

RAW_VARIANTS = {
    "variants": [
        {"title": "干皮姐妹别划走", "hook": "敷完第二天上妆不卡粉", "angle": "痛点"},
        {"title": "28 天回购三次的面膜", "hook": "学生党也买得起", "angle": "数字"},
        {"title": "我室友以为我打了水光针", "hook": "补水肉眼可见", "angle": "反差"},
    ]
}


def test_compute_winner_by_cvr() -> None:
    exp = Experiment(variants=[
        {"label": "A", "title": "a", "hook": "", "impressions": 1000, "clicks": 80, "conversions": 10},
        {"label": "B", "title": "b", "hook": "", "impressions": 1000, "clicks": 60, "conversions": 25},
        {"label": "C", "title": "c", "hook": "", "impressions": 300, "clicks": 20, "conversions": 2},
    ])
    compute_winner(exp)
    assert exp.winner_label == "B"  # 最高转化率
    assert exp.status == "decided"


def test_compute_winner_stays_running_without_data() -> None:
    exp = Experiment(variants=[{"label": "A", "title": "a", "hook": "", "impressions": 0, "clicks": 0, "conversions": 0}])
    compute_winner(exp)
    assert exp.winner_label is None
    assert exp.status == "running"
    assert exp.confidence_level == "insufficient"


def test_compute_winner_waits_until_every_variant_reaches_minimum_sample() -> None:
    exp = Experiment(variants=[
        {"label": "A", "title": "a", "hook": "", "impressions": 1000, "clicks": 80, "conversions": 30},
        {"label": "B", "title": "b", "hook": "", "impressions": 299, "clicks": 30, "conversions": 5},
    ])
    compute_winner(exp)
    assert exp.winner_label is None
    assert exp.status == "running"
    assert exp.confidence_level == "insufficient"
    assert "还差 1 次" in exp.confidence_message


def test_build_experiment_prompt_injects_decided_winner(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "exp.db"
    from app.workspace import save_experiment
    exp = Experiment(product_id="p1", platform=Platform.XHS.value, name="t", variants=[
        {"label": "A", "title": "干皮姐妹别划走", "hook": "敷完不卡粉", "impressions": 1000, "clicks": 80, "conversions": 30},
        {"label": "B", "title": "普通标题", "hook": "", "impressions": 1000, "clicks": 40, "conversions": 5},
    ])
    compute_winner(exp)
    save_experiment(exp)
    prompt = build_experiment_prompt("p1", Platform.XHS)
    assert "A/B 验证过的高转化表达" in prompt
    assert "干皮姐妹别划走" in prompt
    assert "普通标题" not in prompt  # 输家不注入
    # 平台不匹配则不注入
    assert build_experiment_prompt("p1", Platform.DOUYIN) == ""


def test_save_experiment_revokes_legacy_premature_winner(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "legacy_exp.db"
    from app.workspace import save_experiment

    exp = Experiment(product_id="p1", platform=Platform.XHS.value, status="decided", winner_label="A", variants=[
        {"label": "A", "title": "过早赢家", "hook": "", "impressions": 1, "clicks": 1, "conversions": 1},
        {"label": "B", "title": "未投放", "hook": "", "impressions": 0, "clicks": 0, "conversions": 0},
    ])
    saved = save_experiment(exp)
    assert saved.status == "running"
    assert saved.winner_label is None
    assert build_experiment_prompt("p1", Platform.XHS) == ""


@pytest.mark.asyncio
async def test_generate_variants_labels_and_zeroes(monkeypatch) -> None:
    async def fake(self, system_prompt: str, user_prompt: str) -> dict:
        return RAW_VARIANTS

    monkeypatch.setattr(DeepSeekClient, "complete_json", fake)
    variants = await generate_variants(None, Platform.XHS.value, "补水面膜", Settings(deepseek_api_key="x"), n=3)
    assert [v["label"] for v in variants] == ["A", "B", "C"]
    assert all(v["impressions"] == 0 and v["conversions"] == 0 for v in variants)
    assert variants[0]["title"] == "干皮姐妹别划走"


@pytest.mark.asyncio
async def test_generate_variants_rejects_empty() -> None:
    with pytest.raises(ValueError):
        await generate_variants(None, Platform.XHS.value, "   ", Settings(deepseek_api_key="x"))


@pytest.mark.asyncio
async def test_generate_variants_rejects_single_variant(monkeypatch) -> None:
    async def fake(self, system_prompt: str, user_prompt: str) -> dict:
        return {"variants": [{"title": "只有一个", "hook": "无法对比", "angle": "单一"}]}

    monkeypatch.setattr(DeepSeekClient, "complete_json", fake)
    with pytest.raises(DeepSeekError, match="不足 2 个"):
        await generate_variants(None, Platform.XHS.value, "补水面膜", Settings(deepseek_api_key="x"))


def test_experiment_api_flow(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "exp_api.db"

    async def fake(self, system_prompt: str, user_prompt: str) -> dict:
        return RAW_VARIANTS

    monkeypatch.setattr(DeepSeekClient, "complete_json", fake)

    with TestClient(app) as client:
        gen = client.post("/api/experiments/generate", json={"platform": "xhs", "brief": "补水面膜 A/B"})
        assert gen.status_code == 200
        exp = gen.json()
        assert len(exp["variants"]) == 3 and exp["status"] == "running"
        eid = exp["id"]

        # 录入 B 占优的指标
        client.post(f"/api/experiments/{eid}/metrics", json={"label": "A", "impressions": 1000, "clicks": 80, "conversions": 10})
        waiting = client.post(f"/api/experiments/{eid}/metrics", json={"label": "B", "impressions": 1000, "clicks": 60, "conversions": 30}).json()
        assert waiting["winner_label"] is None
        assert waiting["confidence_level"] == "insufficient"
        decided = client.post(f"/api/experiments/{eid}/metrics", json={"label": "C", "impressions": 300, "clicks": 20, "conversions": 2}).json()
        assert decided["winner_label"] == "B"
        assert decided["status"] == "decided"
        assert decided["confidence_level"] == "ready"
        assert "不代表统计显著性" in decided["confidence_message"]

        # 漏斗关系不合法时拒绝，且不修改已有数据
        invalid_clicks = client.post(f"/api/experiments/{eid}/metrics", json={"label": "A", "impressions": 10, "clicks": 11, "conversions": 1})
        assert invalid_clicks.status_code == 422
        invalid_conversions = client.post(f"/api/experiments/{eid}/metrics", json={"label": "A", "impressions": 100, "clicks": 10, "conversions": 11})
        assert invalid_conversions.status_code == 422

        listed = client.get("/api/experiments")
        assert any(e["id"] == eid for e in listed.json())

        # studio 平台拒绝
        assert client.post("/api/experiments/generate", json={"platform": "studio", "brief": "x"}).status_code == 422
        # 不存在的实验
        assert client.post("/api/experiments/nope/metrics", json={"label": "A"}).status_code == 404

        deleted = client.delete(f"/api/experiments/{eid}")
        assert deleted.json()["deleted"] is True

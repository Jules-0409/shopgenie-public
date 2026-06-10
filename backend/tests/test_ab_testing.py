from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import app.memory as memory
from app.config import Settings
from app.deepseek import DeepSeekClient
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
        {"label": "C", "title": "c", "hook": "", "impressions": 0, "clicks": 0, "conversions": 0},
    ])
    compute_winner(exp)
    assert exp.winner_label == "B"  # 最高转化率
    assert exp.status == "decided"


def test_compute_winner_stays_running_without_data() -> None:
    exp = Experiment(variants=[{"label": "A", "title": "a", "hook": "", "impressions": 0, "clicks": 0, "conversions": 0}])
    compute_winner(exp)
    assert exp.winner_label is None
    assert exp.status == "running"


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
        decided = client.post(f"/api/experiments/{eid}/metrics", json={"label": "B", "impressions": 1000, "clicks": 60, "conversions": 30}).json()
        assert decided["winner_label"] == "B"
        assert decided["status"] == "decided"

        listed = client.get("/api/experiments")
        assert any(e["id"] == eid for e in listed.json())

        # studio 平台拒绝
        assert client.post("/api/experiments/generate", json={"platform": "studio", "brief": "x"}).status_code == 422
        # 不存在的实验
        assert client.post("/api/experiments/nope/metrics", json={"label": "A"}).status_code == 404

        deleted = client.delete(f"/api/experiments/{eid}")
        assert deleted.json()["deleted"] is True

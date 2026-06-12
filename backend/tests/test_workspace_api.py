from pathlib import Path

from fastapi.testclient import TestClient

import app.memory as memory
from app.config import Settings, get_settings
from app.deepseek import DeepSeekClient, DeepSeekError
from app.main import app
from app.schemas import ChatRequest, ChatResponse, GeneratedContent, Platform, Usage
from app.workspace import create_content_asset


def test_workspace_api_flow(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    with TestClient(app) as client:
        product = client.post("/api/products", json={
            "name": "轻量保温杯",
            "category": "家居",
            "selling_points": ["轻量"],
            "facts": ["容量 500ml"],
        })
        source = client.post("/api/knowledge", json={
            "title": "小红书规则",
            "platform": "xhs",
            "content": "避免硬广表达",
        })
        performance = client.post("/api/performance", json={
            "asset_id": "content_demo",
            "platform": "xhs",
            "impressions": 1200,
            "conversions": 8,
        })

        products = client.get("/api/products")
        sources = client.get("/api/knowledge")
        metrics = client.get("/api/performance")
        operations = client.get("/api/operations/brief")

    assert product.status_code == 200
    assert source.status_code == 200
    assert performance.status_code == 200
    assert products.json()[0]["name"] == "轻量保温杯"
    assert sources.json()[0]["title"] == "小红书规则"
    assert metrics.json()[0]["conversions"] == 8
    assert operations.status_code == 200
    assert operations.json()["actions"]


def test_performance_csv_api_preview_then_import(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    with TestClient(app) as client:
        asset = create_content_asset(GeneratedContent(
            platform=Platform.XHS,
            title="测试内容",
            body="完整正文" * 30,
            tags=["测试", "内容", "运营"],
        ))[0]
        csv_text = f"asset_id,impressions,clicks,orders,revenue,ad_spend\n{asset.id},1000,80,6,600,120\n"
        preview = client.post("/api/performance/import/preview", json={"csv_text": csv_text})
        before = client.get("/api/performance")
        imported = client.post("/api/performance/import", json={"csv_text": csv_text})
        after = client.get("/api/performance")

    assert preview.status_code == 200
    assert preview.json()["rows"] == 1
    assert before.json() == []
    assert imported.json() == {"imported": 1}
    assert after.json()[0]["orders"] == 6


def test_performance_csv_api_rejects_missing_asset(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    with TestClient(app) as client:
        response = client.post("/api/performance/import/preview", json={
            "csv_text": "asset_id,impressions\nmissing,100\n",
        })

    assert response.status_code == 422
    assert "不存在" in response.json()["detail"]


def test_knowledge_import_saves_original_url(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"

    async def fake_fetch(url: str) -> tuple[str, str]:
        return "官方平台规则", "避免绝对化宣传"

    monkeypatch.setattr("app.main.fetch_public_page", fake_fetch)
    with TestClient(app) as client:
        response = client.post("/api/knowledge/import", json={"url": "https://example.com/rules", "platform": "xhs"})

    assert response.status_code == 200
    assert response.json()["title"] == "官方平台规则"
    assert response.json()["url"] == "https://example.com/rules"


def test_product_api_rejects_empty_name(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    with TestClient(app) as client:
        response = client.post("/api/products", json={"name": ""})
    assert response.status_code == 422


def test_chat_saves_asset_task_and_explicit_product_fact(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"

    async def fake_chat(self: DeepSeekClient, request: ChatRequest) -> ChatResponse:
        return ChatResponse(
            message="已生成",
            result=GeneratedContent(
                platform=Platform.XHS,
                title="保温杯使用分享",
                body="这是一段包含场景和卖点的完整正文。" * 8,
                tags=["保温杯", "通勤好物", "使用分享"],
            ),
            model="test-model",
            usage=Usage(),
        )

    monkeypatch.setattr(DeepSeekClient, "chat", fake_chat)
    app.dependency_overrides[get_settings] = lambda: Settings(deepseek_api_key="test-key")
    try:
        with TestClient(app) as client:
            product = client.post("/api/products", json={"name": "保温杯"}).json()
            response = client.post("/api/chat", json={
                "platform": "xhs",
                "message": "事实：容量 500ml",
                "product_id": product["id"],
            })
            loaded_product = client.get("/api/products").json()[0]
            assets = client.get("/api/content").json()
            tasks = client.get("/api/tasks").json()
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["asset_id"] == assets[0]["id"]
    assert response.json()["quality"]["score"] > 0
    assert loaded_product["facts"] == ["容量 500ml"]
    assert tasks[0]["status"] == "completed"


def test_chat_marks_task_failed_when_model_fails(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"

    async def fail_chat(self: DeepSeekClient, request: ChatRequest) -> ChatResponse:
        raise DeepSeekError("上游失败")

    monkeypatch.setattr(DeepSeekClient, "chat", fail_chat)
    app.dependency_overrides[get_settings] = lambda: Settings(deepseek_api_key="test-key")
    try:
        with TestClient(app) as client:
            response = client.post("/api/chat", json={"platform": "xhs", "message": "生成笔记"})
            tasks = client.get("/api/tasks").json()
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 502
    assert tasks[0]["status"] == "failed"
    assert tasks[0]["result_summary"] == "上游失败"


def test_agent_run_creates_new_content_version(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    asset, _ = create_content_asset(GeneratedContent(
        platform=Platform.XHS,
        title="原始标题",
        body="原始正文" * 30,
        tags=["分享", "好物", "生活"],
    ))

    async def revise_chat(self: DeepSeekClient, request: ChatRequest) -> ChatResponse:
        return ChatResponse(
            message="已优化",
            result=GeneratedContent(
                platform=Platform.XHS,
                title="优化后的真实分享",
                body="优化后的完整正文" * 30,
                tags=["分享", "好物", "生活"],
            ),
            model="test-model",
            usage=Usage(),
        )

    monkeypatch.setattr(DeepSeekClient, "chat", revise_chat)
    app.dependency_overrides[get_settings] = lambda: Settings(deepseek_api_key="test-key")
    try:
        with TestClient(app) as client:
            response = client.post("/api/tasks/run", json={"asset_id": asset.id, "objective": "增强真实分享感"})
            versions = client.get(f"/api/content/{asset.id}/versions").json()
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["task"]["status"] == "completed"
    assert response.json()["version"]["version"] == 2
    assert versions[0]["content"]["title"] == "优化后的真实分享"


def test_chat_discovers_sources_for_explicit_research_request(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    discovered: list[str] = []

    async def fake_discover(query: str, platform: Platform) -> list:
        discovered.append(f"{platform.value}:{query}")
        return []

    async def fake_chat(self: DeepSeekClient, request: ChatRequest) -> ChatResponse:
        return ChatResponse(message="调研完成", model="test-model", usage=Usage())

    monkeypatch.setattr("app.main.discover_knowledge", fake_discover)
    monkeypatch.setattr(DeepSeekClient, "chat", fake_chat)
    app.dependency_overrides[get_settings] = lambda: Settings(deepseek_api_key="test-key")
    try:
        with TestClient(app) as client:
            response = client.post("/api/chat", json={"platform": "xhs", "message": "查一下最新家居内容趋势"})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert discovered == ["xhs:查一下最新家居内容趋势"]

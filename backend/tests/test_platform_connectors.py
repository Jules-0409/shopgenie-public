import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

import app.memory as memory
from app.config import Settings, get_settings
from app.main import app
from app.platform_connectors import list_connector_status, sync_platform_performance
from app.schemas import GeneratedContent, Platform
from app.workspace import create_content_asset, list_performance


def connector_settings() -> Settings:
    return Settings(
        deepseek_api_key="test",
        platform_api_connectors_json=json.dumps({
            "dy": {"base_url": "https://metrics.example.com", "token": "readonly-token", "metrics_path": "/v1/metrics"}
        }),
    )


def test_connector_status_does_not_expose_token() -> None:
    status = list_connector_status(connector_settings())
    assert next(item for item in status if item["platform"] == "dy")["configured"] is True
    assert "token" not in status[0]


@pytest.mark.asyncio
async def test_platform_sync_is_idempotent_and_validates_asset_platform(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    asset = create_content_asset(GeneratedContent(platform=Platform.DOUYIN, title="脚本", body="正文"))[0]

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer readonly-token"
        return httpx.Response(200, json={"records": [{
            "record_id": "remote-1", "asset_id": asset.id, "impressions": 1000, "clicks": 60,
            "orders": 5, "conversions": 5, "refunds": 1, "revenue": 500, "ad_spend": 100,
        }]})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        first = await sync_platform_performance(Platform.DOUYIN, connector_settings(), client)
        second = await sync_platform_performance(Platform.DOUYIN, connector_settings(), client)

    assert first["imported"] == 1
    assert second["imported"] == 1
    assert len(list_performance()) == 1


@pytest.mark.asyncio
async def test_platform_sync_rejects_invalid_batch_without_writing(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    asset = create_content_asset(GeneratedContent(platform=Platform.DOUYIN, title="脚本", body="正文"))[0]
    payload = {"records": [{"record_id": "bad", "asset_id": asset.id, "impressions": 10, "clicks": 20}]}
    async with httpx.AsyncClient(transport=httpx.MockTransport(lambda request: httpx.Response(200, json=payload))) as client:
        with pytest.raises(ValueError, match="点击量不能大于曝光量"):
            await sync_platform_performance(Platform.DOUYIN, connector_settings(), client)
    assert list_performance() == []


def test_connector_api_reports_configuration_and_syncs_explicitly(tmp_path: Path, monkeypatch) -> None:
    memory.DB_PATH = tmp_path / "workspace.db"
    async def fake_sync(platform: Platform, settings: Settings) -> dict[str, object]:
        return {"platform": platform.value, "imported": 2, "records": []}

    monkeypatch.setattr("app.main.sync_platform_performance", fake_sync)
    app.dependency_overrides[get_settings] = connector_settings
    try:
        with TestClient(app) as client:
            response = client.get("/api/platform-connectors")
            synced = client.post("/api/platform-connectors/dy/sync")
            unsupported = client.post("/api/platform-connectors/studio/sync")
    finally:
        app.dependency_overrides.clear()
    assert response.status_code == 200
    assert synced.json()["imported"] == 2
    assert unsupported.status_code == 422

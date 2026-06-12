import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.workspace import ContentAsset, save_content_asset
from app.memory import UserProfile, save_profile, delete_profile

def test_marketing_calendar_flow():
    client = TestClient(app)
    
    # 1. 创建美妆品类的品牌档案
    profile = UserProfile(
        brand_name="美妆品牌",
        category="美妆护肤",
        tone="温柔",
        target_audience="女生",
        platforms=["xhs"],
        style_preferences=[],
        taboo_words=[],
        extra_notes=""
    )
    save_profile(profile)
    
    try:
        # 2. 查询营销日历
        response = client.get("/api/marketing/calendar")
        assert response.status_code == 200
        data = response.json()
        assert "events" in data
        assert "scheduled_assets" in data
        
        # 3. 校验 618 营销节点和品类匹配的选题推荐
        promo_618 = next((e for e in data["events"] if e["id"] == "promotion-618"), None)
        assert promo_618 is not None
        assert "618 终极省钱" in promo_618["topics"][0]
        
    finally:
        delete_profile()

def test_schedule_asset_api():
    client = TestClient(app)
    
    # 1. 创建测试内容资产
    asset = ContentAsset(name="测试排期资产", platform="xhs")
    save_content_asset(asset)
    
    try:
        # 2. 对内容资产进行排期
        response = client.post(
            f"/api/content/{asset.id}/schedule",
            json={"scheduled_at": "2026-06-15"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scheduled_at"] == "2026-06-15"
        
        # 3. 检查营销日历是否返回已排期资产
        response = client.get("/api/marketing/calendar")
        assert response.status_code == 200
        data = response.json()
        assert len(data["scheduled_assets"]) > 0
        scheduled = next((a for a in data["scheduled_assets"] if a["id"] == asset.id), None)
        assert scheduled is not None
        assert scheduled["scheduled_at"] == "2026-06-15"
        
        # 4. 取消排期
        response = client.post(
            f"/api/content/{asset.id}/schedule",
            json={"scheduled_at": None}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["scheduled_at"] is None
        
    finally:
        from app.workspace import delete_content_asset
        delete_content_asset(asset.id)

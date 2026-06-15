"""Read-only platform API connectors for importing performance data."""
import asyncio
import hashlib
import json
from dataclasses import asdict
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from app.config import Settings
from app.schemas import Platform
from app.workspace import PerformanceRecord, get_content_asset, save_performance_batch

SUPPORTED_PLATFORMS = (Platform.XHS, Platform.DOUYIN, Platform.AMAZON)
MAX_SYNC_RECORDS = 500


def _connector_configs(settings: Settings) -> dict[str, dict[str, str]]:
    try:
        raw = json.loads(settings.platform_api_connectors_json or "{}")
    except json.JSONDecodeError as exc:
        raise ValueError("平台 API 连接器配置不是合法 JSON") from exc
    if not isinstance(raw, dict):
        raise ValueError("平台 API 连接器配置必须是对象")
    configs: dict[str, dict[str, str]] = {}
    for platform, value in raw.items():
        if platform not in {item.value for item in SUPPORTED_PLATFORMS} or not isinstance(value, dict):
            continue
        base_url = str(value.get("base_url", "")).strip()
        token = str(value.get("token", "")).strip()
        metrics_path = str(value.get("metrics_path", "/metrics")).strip() or "/metrics"
        parsed = urlparse(base_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError(f"{platform} 平台 API base_url 必须是公开 HTTPS 地址")
        if not token:
            raise ValueError(f"{platform} 平台 API 缺少只读令牌")
        configs[platform] = {"base_url": base_url.rstrip("/") + "/", "token": token, "metrics_path": metrics_path.lstrip("/")}
    return configs


def list_connector_status(settings: Settings) -> list[dict[str, str | bool]]:
    configs = _connector_configs(settings)
    return [
        {
            "platform": platform.value,
            "configured": platform.value in configs,
            "mode": "read_only",
        }
        for platform in SUPPORTED_PLATFORMS
    ]


def _non_negative_number(record: dict[str, Any], field: str, *, integer: bool) -> int | float:
    value = record.get(field, 0)
    if isinstance(value, bool):
        raise ValueError(f"{field} 必须是非负数字")
    try:
        number = int(value) if integer else float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field} 必须是非负{'整数' if integer else '数字'}") from exc
    if number < 0:
        raise ValueError(f"{field} 不能为负数")
    return number


def _normalize_records(platform: Platform, payload: object) -> list[PerformanceRecord]:
    raw_records = payload.get("records") if isinstance(payload, dict) else payload
    if not isinstance(raw_records, list):
        raise ValueError("平台 API 响应必须是 records 数组")
    if not raw_records:
        return []
    if len(raw_records) > MAX_SYNC_RECORDS:
        raise ValueError(f"单次同步最多 {MAX_SYNC_RECORDS} 条记录")

    records: list[PerformanceRecord] = []
    for index, raw in enumerate(raw_records, start=1):
        if not isinstance(raw, dict):
            raise ValueError(f"第 {index} 条平台数据不是对象")
        remote_id = str(raw.get("record_id", "")).strip()
        asset_id = str(raw.get("asset_id", "")).strip()
        if not remote_id or not asset_id:
            raise ValueError(f"第 {index} 条平台数据缺少 record_id 或 asset_id")
        asset = get_content_asset(asset_id)
        if not asset:
            raise ValueError(f"第 {index} 条平台数据绑定的内容资产 {asset_id} 不存在")
        if asset.platform != platform.value:
            raise ValueError(f"第 {index} 条平台数据与内容资产平台不一致")

        integers = {
            field: _non_negative_number(raw, field, integer=True)
            for field in ("impressions", "engagements", "clicks", "add_to_carts", "orders", "conversions", "refunds")
        }
        floats = {field: _non_negative_number(raw, field, integer=False) for field in ("revenue", "ad_spend")}
        if integers["clicks"] > integers["impressions"]:
            raise ValueError(f"第 {index} 条平台数据点击量不能大于曝光量")
        if integers["orders"] > integers["clicks"] or integers["conversions"] > integers["clicks"] or integers["refunds"] > integers["orders"]:
            raise ValueError(f"第 {index} 条平台数据漏斗关系无效")
        recorded_at = str(raw.get("recorded_at") or PerformanceRecord().recorded_at)
        try:
            datetime.fromisoformat(recorded_at)
        except ValueError as exc:
            raise ValueError(f"第 {index} 条平台数据 recorded_at 不是合法 ISO 时间") from exc
        stable_id = hashlib.sha256(f"{platform.value}:{remote_id}".encode()).hexdigest()[:20]
        records.append(PerformanceRecord(
            id=f"metric_sync_{stable_id}",
            asset_id=asset_id,
            platform=platform.value,
            notes=f"平台 API 只读同步 · {remote_id}",
            recorded_at=recorded_at,
            **integers,
            **floats,
        ))
    return records


async def sync_platform_performance(
    platform: Platform,
    settings: Settings,
    client: httpx.AsyncClient | None = None,
) -> dict[str, object]:
    if platform not in SUPPORTED_PLATFORMS:
        raise ValueError(f"平台 {platform.value} 不支持效果数据连接器")
    config = _connector_configs(settings).get(platform.value)
    if not config:
        raise ValueError(f"{platform.value} 平台 API 尚未配置")
    url = urljoin(config["base_url"], config["metrics_path"])
    headers = {"Authorization": f"Bearer {config['token']}", "Accept": "application/json"}
    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=20, follow_redirects=False)
    try:
        response = await http.get(url, headers=headers, params={"limit": MAX_SYNC_RECORDS})
        response.raise_for_status()
        records = await asyncio.to_thread(_normalize_records, platform, response.json())
    except httpx.HTTPStatusError as exc:
        raise ValueError(f"{platform.value} 平台 API 返回错误状态 {exc.response.status_code}") from exc
    except (httpx.HTTPError, json.JSONDecodeError) as exc:
        raise ValueError(f"无法读取 {platform.value} 平台 API 数据") from exc
    finally:
        if owns_client:
            await http.aclose()
    await asyncio.to_thread(save_performance_batch, records)
    return {"platform": platform.value, "imported": len(records), "records": [asdict(record) for record in records[:5]]}

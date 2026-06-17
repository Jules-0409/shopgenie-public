"""效果数据 CSV 预览校验与批量导入。"""
import csv
import io
from dataclasses import asdict

from app.auth import DEFAULT_OWNER_ID
from app.workspace import PerformanceRecord, get_content_asset, save_performance_batch

MAX_CSV_CHARS = 200_000
MAX_CSV_ROWS = 500
INTEGER_FIELDS = ("impressions", "engagements", "clicks", "add_to_carts", "orders", "conversions", "refunds")
FLOAT_FIELDS = ("revenue", "ad_spend")


def _parse_number(value: str, field: str, row_number: int, *, integer: bool) -> int | float:
    clean = value.strip()
    if not clean:
        return 0
    try:
        number = int(clean) if integer else float(clean)
    except ValueError as exc:
        raise ValueError(f"第 {row_number} 行：{field} 必须是非负{'整数' if integer else '数字'}") from exc
    if number < 0:
        raise ValueError(f"第 {row_number} 行：{field} 不能为负数")
    return number


def parse_performance_csv(csv_text: str, owner_id: str = DEFAULT_OWNER_ID) -> list[PerformanceRecord]:
    text = (csv_text or "").strip()
    if not text:
        raise ValueError("CSV 内容为空")
    if len(text) > MAX_CSV_CHARS:
        raise ValueError(f"CSV 内容不能超过 {MAX_CSV_CHARS} 个字符")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames or "asset_id" not in reader.fieldnames:
        raise ValueError("CSV 缺少必填列 asset_id")

    records: list[PerformanceRecord] = []
    for row_number, row in enumerate(reader, start=2):
        if len(records) >= MAX_CSV_ROWS:
            raise ValueError(f"单次最多导入 {MAX_CSV_ROWS} 行")
        asset_id = (row.get("asset_id") or "").strip()
        if not asset_id:
            raise ValueError(f"第 {row_number} 行：asset_id 不能为空")
        asset = get_content_asset(asset_id, owner_id)
        if not asset:
            raise ValueError(f"第 {row_number} 行：内容资产 {asset_id} 不存在")
        values = {
            field: _parse_number(row.get(field) or "", field, row_number, integer=True)
            for field in INTEGER_FIELDS
        }
        values.update({
            field: _parse_number(row.get(field) or "", field, row_number, integer=False)
            for field in FLOAT_FIELDS
        })
        records.append(PerformanceRecord(
            asset_id=asset_id,
            platform=asset.platform,
            notes=(row.get("notes") or "").strip()[:1000],
            **values,
        ))
    if not records:
        raise ValueError("CSV 没有可导入的数据行")
    return records


def preview_performance_csv(csv_text: str, owner_id: str = DEFAULT_OWNER_ID) -> dict[str, object]:
    records = parse_performance_csv(csv_text, owner_id)
    return {
        "valid": True,
        "rows": len(records),
        "preview": [asdict(record) for record in records[:5]],
    }


def import_performance_csv(csv_text: str, owner_id: str = DEFAULT_OWNER_ID) -> dict[str, object]:
    records = parse_performance_csv(csv_text, owner_id)
    save_performance_batch(records, owner_id)
    return {"imported": len(records)}

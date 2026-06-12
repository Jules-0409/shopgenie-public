"""每日运营指挥台：用确定性规则生成可解释、可执行的运营建议。"""
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta

from app.workspace import (
    ContentAsset,
    Experiment,
    PerformanceRecord,
    Product,
    list_content_assets,
    list_experiments,
    list_performance,
    list_products,
    get_action_states,
)

MAX_ACTIONS = 5
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

CTR_BENCHMARKS = {
    "xhs": 3.0,
    "dy": 1.5,
    "amazon": 0.5,
}

PLATFORM_LABELS = {
    "xhs": "小红书",
    "dy": "抖音",
    "amazon": "Amazon",
    "cs": "客服",
}


@dataclass
class OperationsAction:
    id: str
    priority: str
    title: str
    reason: str
    metric: str
    target_tab: str
    product_id: str | None = None
    asset_id: str | None = None
    action_type: str | None = None
    action_params: dict | None = None
    impression_impact: int = 0


def _is_within_days(date_str: str, days: int) -> bool:
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        now = datetime.now(dt.tzinfo or UTC)
        return (now - dt) <= timedelta(days=days)
    except Exception:
        return False


def _performance_actions(
    assets: list[ContentAsset],
    records: list[PerformanceRecord],
) -> list[OperationsAction]:
    asset_map = {asset.id: asset for asset in assets}
    
    # 1. Filter records within the last 14 days
    records_14d = [r for r in records if _is_within_days(r.recorded_at, 14)]
    
    # 2. Aggregate metrics by asset_id
    aggregated: dict[str, dict] = {}
    for r in records_14d:
        aid = r.asset_id
        if not aid or aid not in asset_map:
            continue
        if aid not in aggregated:
            aggregated[aid] = {
                "impressions": 0,
                "clicks": 0,
                "orders": 0,
                "refunds": 0,
                "recent_impressions": 0,
                "recent_clicks": 0,
                "past_impressions": 0,
                "past_clicks": 0,
            }
        
        aggregated[aid]["impressions"] += r.impressions
        aggregated[aid]["clicks"] += r.clicks
        aggregated[aid]["orders"] += r.orders or r.conversions or 0
        aggregated[aid]["refunds"] += r.refunds or 0
        
        # Split into 0-7 days (recent) vs 7-14 days (past)
        if _is_within_days(r.recorded_at, 7):
            aggregated[aid]["recent_impressions"] += r.impressions
            aggregated[aid]["recent_clicks"] += r.clicks
        else:
            aggregated[aid]["past_impressions"] += r.impressions
            aggregated[aid]["past_clicks"] += r.clicks
            
    actions: list[OperationsAction] = []
    
    # 3. Generate actions based on aggregated metrics
    for aid, m in aggregated.items():
        asset = asset_map[aid]
        platform_key = asset.platform.lower()
        platform_label = PLATFORM_LABELS.get(platform_key, asset.platform)
        benchmark = CTR_BENCHMARKS.get(platform_key, 1.0)
        
        ctr = (m["clicks"] / m["impressions"] * 100) if m["impressions"] > 0 else 0.0
        cvr = (m["orders"] / m["clicks"] * 100) if m["clicks"] > 0 else 0.0
        refund_rate = (m["refunds"] / m["orders"] * 100) if m["orders"] > 0 else 0.0
        
        # Rule 1: CTR decline trend alert
        if m["recent_impressions"] >= 100 and m["past_impressions"] >= 100:
            recent_ctr = (m["recent_clicks"] / m["recent_impressions"] * 100)
            past_ctr = (m["past_clicks"] / m["past_impressions"] * 100)
            if recent_ctr < 0.8 * past_ctr:
                actions.append(OperationsAction(
                    id=f"ctr-decline-{aid}",
                    priority="high",
                    title=f"排查「{asset.name}」的点击率下滑",
                    reason=f"该内容在{platform_label}的近 7 天点击率（{recent_ctr:.2f}%）较前 7 天（{past_ctr:.2f}%）下降超 20%，需排查受众疲劳。",
                    metric=f"近7天CTR {recent_ctr:.2f}% · 前7天CTR {past_ctr:.2f}%",
                    target_tab="experiments",
                    product_id=asset.product_id,
                    asset_id=asset.id,
                    action_type="optimize_content",
                    action_params={"platform": asset.platform, "product_id": asset.product_id, "brief": f"针对「{asset.name}」在 {platform_label} 点击率下滑，微调优化内容。"},
                    impression_impact=m["impressions"],
                ))
        
        # Rule 2: Low click CTR alert
        if m["impressions"] >= 100 and ctr < benchmark:
            actions.append(OperationsAction(
                id=f"low-click-{aid}",
                priority="high",
                title=f"优化「{asset.name}」的标题与开头",
                reason=f"该内容在{platform_label}平台的点击率低于行业基准（{benchmark:.1f}%）。建议优先检查标题或前三秒钩子。",
                metric=f"曝光 {m['impressions']} · 点击率 {ctr:.2f}% (基准 {benchmark:.1f}%)",
                target_tab="experiments",
                product_id=asset.product_id,
                asset_id=asset.id,
                action_type="optimize_title",
                action_params={"platform": asset.platform, "product_id": asset.product_id, "brief": f"优化「{asset.name}」在 {platform_label} 的标题与开头。"},
                impression_impact=m["impressions"],
            ))
            
        # Rule 3: Low conversion alert
        if m["clicks"] >= 20 and cvr < 2.0:
            actions.append(OperationsAction(
                id=f"low-conversion-{aid}",
                priority="high",
                title=f"检查「{asset.name}」的转化表达",
                reason=f"该内容在{platform_label}平台的点击量已成规模，但点击后转化率低于基准（2.0%）。建议核对卖点、商品事实与下单引导。",
                metric=f"点击 {m['clicks']} · 转化率 {cvr:.2f}% (基准 2.0%)",
                target_tab="content",
                product_id=asset.product_id,
                asset_id=asset.id,
                action_type="optimize_content",
                action_params={"platform": asset.platform, "product_id": asset.product_id, "brief": f"检查「{asset.name}」在 {platform_label} 的转化与下单引导。"},
                impression_impact=m["impressions"],
            ))
            
        # Rule 4: High refund alert
        if m["orders"] >= 10 and refund_rate > 10.0:
            actions.append(OperationsAction(
                id=f"high-refund-{aid}",
                priority="high",
                title=f"排查「{asset.name}」的退款原因",
                reason=f"该内容在{platform_label}平台的下单退款率已超过 10%。建议核对宣传承诺与商品事实的一致性。",
                metric=f"下单 {m['orders']} · 退款率 {refund_rate:.2f}%",
                target_tab="performance",
                product_id=asset.product_id,
                asset_id=asset.id,
                action_type="review_performance",
                action_params={"platform": asset.platform, "product_id": asset.product_id},
                impression_impact=m["impressions"],
            ))
            
    return actions


def _review_action(products: list[Product]) -> OperationsAction | None:
    missing = [product for product in products if not product.review_insights]
    if not missing:
        return None
    names = "、".join(product.name for product in missing[:2])
    suffix = f"等 {len(missing)} 个商品" if len(missing) > 2 else ""
    return OperationsAction(
        id="missing-review-insights",
        priority="medium",
        title="补充真实买家评论洞察",
        reason=f"{names}{suffix}还没有评论洞察，生成内容暂时无法使用买家的真实语言。",
        metric=f"{len(missing)} 个商品待分析",
        target_tab="products",
        product_id=missing[0].id,
        action_type="supplement_reviews",
    )


def _backfill_reminder_actions(
    assets: list[ContentAsset],
    records: list[PerformanceRecord],
) -> list[OperationsAction]:
    """已排期发布超过 3 天但仍无效果数据的内容，提醒回填——把数据回流本身纳入建议体系。"""
    assets_with_records = {record.asset_id for record in records}
    actions: list[OperationsAction] = []
    now = datetime.now(UTC)
    for asset in assets:
        if not asset.scheduled_at or asset.id in assets_with_records:
            continue
        try:
            scheduled = datetime.fromisoformat(asset.scheduled_at.replace("Z", "+00:00"))
            if scheduled.tzinfo is None:
                scheduled = scheduled.replace(tzinfo=UTC)
        except ValueError:
            continue
        days = (now - scheduled).days
        if days < 3:
            continue
        actions.append(OperationsAction(
            id=f"backfill-{asset.id}",
            priority="medium",
            title=f"回填「{asset.name}」的发布效果",
            reason=f"这条内容排期发布已 {days} 天，还没有效果数据。回填后才能进入诊断和 A/B 反哺。",
            metric=f"发布 {days} 天 · 0 条回流",
            target_tab="performance",
            product_id=asset.product_id,
            asset_id=asset.id,
            action_type="import_performance",
        ))
    return actions


def _experiment_action(experiments: list[Experiment]) -> OperationsAction | None:
    waiting = [experiment for experiment in experiments if experiment.status == "running"]
    if not waiting:
        return None
    return OperationsAction(
        id="experiments-waiting-for-data",
        priority="medium",
        title="继续投放 A/B 变体，补足判断样本",
        reason="这些实验尚未达到最小样本量，暂时不会宣布赢家或反哺后续生成。",
        metric=f"{len(waiting)} 个实验样本不足",
        target_tab="experiments",
        product_id=waiting[0].product_id,
        action_type="continue_ab_variants",
        action_params={"platform": waiting[0].platform, "product_id": waiting[0].product_id},
    )


def build_operations_brief() -> dict[str, object]:
    products = list_products()
    assets = list_content_assets()
    records = list_performance()
    experiments = list_experiments()
    action_states = get_action_states()
    
    raw_actions: list[OperationsAction] = []

    if not products:
        raw_actions.append(OperationsAction(
            id="create-first-product",
            priority="high",
            title="先建立第一个商品事实卡",
            reason="商品事实是内容生成、质量检查和运营诊断的共同底座。",
            metric="0 个商品",
            target_tab="products",
            action_type="create_product",
        ))
    else:
        review_action = _review_action(products)
        if review_action:
            raw_actions.append(review_action)

    raw_actions.extend(_performance_actions(assets, records))
    raw_actions.extend(_backfill_reminder_actions(assets, records))

    if assets and not records:
        raw_actions.append(OperationsAction(
            id="record-first-performance",
            priority="high",
            title="回填第一条内容的发布效果",
            reason="已有内容资产，但还没有效果数据。录入曝光、点击和转化后才能发现真正的问题。",
            metric=f"{len(assets)} 条内容待回流",
            target_tab="performance",
            asset_id=assets[0].id,
            product_id=assets[0].product_id,
            action_type="import_performance",
        ))

    experiment_action = _experiment_action(experiments)
    if experiment_action:
        raw_actions.append(experiment_action)

    # Filter actions based on database states
    final_actions: list[OperationsAction] = []
    for action in raw_actions:
        if action.id in action_states:
            db_state = action_states[action.id]["state"]
            db_updated_at = action_states[action.id]["last_updated_at"]
            
            if db_state in ("dismissed", "done"):
                # Determine if we reset it to open based on new data
                should_reset = False
                if action.asset_id:
                    # Performance action
                    asset_records = [r for r in records if r.asset_id == action.asset_id]
                    if asset_records:
                        latest_recorded = max(r.recorded_at for r in asset_records)
                        if latest_recorded > db_updated_at:
                            should_reset = True
                elif action.id == "missing-review-insights":
                    missing_products = [p for p in products if not p.review_insights]
                    if missing_products:
                        latest_product_update = max(p.updated_at for p in missing_products)
                        if latest_product_update > db_updated_at:
                            should_reset = True
                elif action.id == "experiments-waiting-for-data":
                    waiting_exps = [e for e in experiments if e.status == "running"]
                    if waiting_exps:
                        latest_exp_update = max(e.updated_at for e in waiting_exps)
                        if latest_exp_update > db_updated_at:
                            should_reset = True
                            
                if not should_reset:
                    continue  # keep hidden
        
        final_actions.append(action)

    # Sort by priority and then by impression_impact descending
    final_actions.sort(key=lambda action: (PRIORITY_ORDER[action.priority], -action.impression_impact, action.id))
    selected = final_actions[:MAX_ACTIONS]
    
    if not selected:
        return {
            "status": "healthy",
            "summary": "当前没有发现需要优先处理的运营风险，继续发布并回填真实效果。",
            "actions": [],
        }
        
    high_count = sum(action.priority == "high" for action in selected)
    return {
        "status": "attention" if high_count else "steady",
        "summary": f"今天建议优先处理 {len(selected)} 件事，其中 {high_count} 件需要尽快关注。",
        "actions": [asdict(action) for action in selected],
    }

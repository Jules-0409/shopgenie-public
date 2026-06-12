"""每日运营指挥台：用确定性规则生成可解释、可执行的运营建议。"""
from dataclasses import asdict, dataclass

from app.workspace import (
    ContentAsset,
    Experiment,
    PerformanceRecord,
    Product,
    list_content_assets,
    list_experiments,
    list_performance,
    list_products,
)

MAX_ACTIONS = 5
PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


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


def _low_click_action(record: PerformanceRecord, asset: ContentAsset) -> OperationsAction | None:
    if record.impressions < 100:
        return None
    click_rate = record.clicks / record.impressions * 100
    if click_rate >= 1:
        return None
    return OperationsAction(
        id=f"low-click-{record.id}",
        priority="high",
        title=f"优化「{asset.name}」的标题与开头",
        reason="这条内容已有一定曝光，但点击率偏低。优先检查标题、封面或前三秒钩子。",
        metric=f"曝光 {record.impressions} · 点击率 {click_rate:.2f}%",
        target_tab="content",
        product_id=asset.product_id,
        asset_id=asset.id,
    )


def _low_conversion_action(record: PerformanceRecord, asset: ContentAsset) -> OperationsAction | None:
    if record.clicks < 20:
        return None
    orders = record.orders or record.conversions
    conversion_rate = orders / record.clicks * 100
    if conversion_rate >= 2:
        return None
    return OperationsAction(
        id=f"low-conversion-{record.id}",
        priority="high",
        title=f"检查「{asset.name}」的转化表达",
        reason="点击量已经形成，但点击后的转化偏低。建议核对卖点、商品事实和下单引导。",
        metric=f"点击 {record.clicks} · 点击后转化率 {conversion_rate:.2f}%",
        target_tab="content",
        product_id=asset.product_id,
        asset_id=asset.id,
    )


def _high_refund_action(record: PerformanceRecord, asset: ContentAsset) -> OperationsAction | None:
    orders = record.orders or record.conversions
    if orders < 10:
        return None
    refund_rate = record.refunds / orders * 100
    if refund_rate <= 10:
        return None
    return OperationsAction(
        id=f"high-refund-{record.id}",
        priority="high",
        title=f"排查「{asset.name}」的退款原因",
        reason="退款率偏高，建议核对宣传承诺、商品事实和客服说明是否与实际体验一致。",
        metric=f"下单 {orders} · 退款率 {refund_rate:.2f}%",
        target_tab="performance",
        product_id=asset.product_id,
        asset_id=asset.id,
    )


def _performance_actions(
    assets: list[ContentAsset],
    records: list[PerformanceRecord],
) -> list[OperationsAction]:
    asset_map = {asset.id: asset for asset in assets}
    actions: list[OperationsAction] = []
    for record in records:
        asset = asset_map.get(record.asset_id)
        if not asset:
            continue
        for action in (_low_click_action(record, asset), _low_conversion_action(record, asset), _high_refund_action(record, asset)):
            if action:
                actions.append(action)
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
    )


def _experiment_action(experiments: list[Experiment]) -> OperationsAction | None:
    waiting = [
        experiment for experiment in experiments
        if experiment.status == "running"
        and not any((variant.get("impressions") or 0) > 0 for variant in experiment.variants)
    ]
    if not waiting:
        return None
    return OperationsAction(
        id="experiments-waiting-for-data",
        priority="medium",
        title="给 A/B 变体回填真实投放数据",
        reason="这些实验已经生成变体，但还没有曝光数据，暂时无法判断哪种表达更有效。",
        metric=f"{len(waiting)} 个实验待投放",
        target_tab="experiments",
        product_id=waiting[0].product_id,
    )


def build_operations_brief() -> dict[str, object]:
    products = list_products()
    assets = list_content_assets()
    records = list_performance()
    experiments = list_experiments()
    actions: list[OperationsAction] = []

    if not products:
        actions.append(OperationsAction(
            id="create-first-product",
            priority="high",
            title="先建立第一个商品事实卡",
            reason="商品事实是内容生成、质量检查和运营诊断的共同底座。",
            metric="0 个商品",
            target_tab="products",
        ))
    else:
        review_action = _review_action(products)
        if review_action:
            actions.append(review_action)

    actions.extend(_performance_actions(assets, records))

    if assets and not records:
        actions.append(OperationsAction(
            id="record-first-performance",
            priority="high",
            title="回填第一条内容的发布效果",
            reason="已有内容资产，但还没有效果数据。录入曝光、点击和转化后才能发现真正的问题。",
            metric=f"{len(assets)} 条内容待回流",
            target_tab="performance",
            asset_id=assets[0].id,
            product_id=assets[0].product_id,
        ))

    experiment_action = _experiment_action(experiments)
    if experiment_action:
        actions.append(experiment_action)

    actions.sort(key=lambda action: (PRIORITY_ORDER[action.priority], action.id))
    selected = actions[:MAX_ACTIONS]
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

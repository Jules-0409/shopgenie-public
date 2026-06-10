"""商品图工作室 V3：三视图即产品身份证。URL自动转base64防过期。"""

import logging, httpx, base64
from app.config import Settings

logger = logging.getLogger(__name__)
GEN_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation"
TASKS_URL = "https://dashscope.aliyuncs.com/api/v1/tasks"
SIZE = "2048*2048"


def _submit(payload: dict, s: Settings) -> str:
    r = httpx.post(GEN_URL, headers={"Authorization": f"Bearer {s.dashscope_api_key}", "Content-Type": "application/json", "X-DashScope-Async": "enable"}, json=payload, timeout=30)
    r.raise_for_status()
    tid = r.json().get("output", {}).get("task_id", "")
    if not tid: raise ValueError(f"no task_id")
    return tid


def _to_b64(ref: str) -> str:
    """如果传入URL，下载并转base64防止OSS签名过期。"""
    if ref.startswith("data:"): return ref
    r = httpx.get(ref, timeout=120); r.raise_for_status()
    ct = r.headers.get("content-type", "image/png")
    return f"data:{ct};base64,{base64.b64encode(r.content).decode()}"


def submit_product_view(base_desc: str, image_b64: str, s: Settings) -> str:
    return _submit({"model": "wan2.7-image", "input": {"messages": [{"role": "user", "content": [
        {"text": f"生成电商产品三视图参考图，白底，正面/侧面/顶面排列整齐。产品：{base_desc}。"},
        *([{"image": _to_b64(image_b64)}] if image_b64 else []),
    ]}]}, "parameters": {"n": 1, "size": SIZE}}, s)


def submit_adjust(ref_b64: str, instructions: str, s: Settings) -> str:
    return _submit({"model": "wan2.7-image", "input": {"messages": [{"role": "user", "content": [
        {"text": f"修改这张三视图。只做以下改动：{instructions}。其他所有细节（形状、颜色、材质、构图）保持与参考图完全一致。白底。"},
        {"image": _to_b64(ref_b64)},
    ]}]}, "parameters": {"n": 1, "size": SIZE}}, s)


def submit_scene(ref_b64: str, prompt: str, s: Settings) -> str:
    return _submit({"model": "wan2.7-image", "input": {"messages": [{"role": "user", "content": [
        {"text": f"参考图是同一件商品的多视角三视图。只提取其中正面视角的那一件商品，最终画面中有且仅有一件商品，禁止出现参考图中的其他视图或商品副本。保持商品外观完全不变，将背景更换为：{prompt}。高分辨率商业摄影，柔和灯光。"},
        {"image": _to_b64(ref_b64)},
    ]}]}, "parameters": {"n": 1, "size": SIZE}}, s)


def submit_tweak(ref_b64: str, instruction: str, s: Settings) -> str:
    return _submit({"model": "wan2.7-image", "input": {"messages": [{"role": "user", "content": [
        {"text": f"微调这张场景图：{instruction}。保持产品和背景构图不变，只做细微调整。"},
        {"image": _to_b64(ref_b64)},
    ]}]}, "parameters": {"n": 1, "size": SIZE}}, s)


async def poll_task(tid: str, s: Settings) -> dict:
    """单次查询任务状态。轮询循环和总超时由前端控制，避免前后端双重轮询。"""
    url = f"{TASKS_URL}/{tid}"
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(url, headers={"Authorization": f"Bearer {s.dashscope_api_key}"}); r.raise_for_status()
        d = r.json(); o = d.get("output", {}); st = o.get("task_status", "")
        if st == "SUCCEEDED":
            res = []
            for ch in (o.get("choices") or []):
                for it in (ch.get("message", {}).get("content") or []):
                    if isinstance(it, dict) and it.get("image"): res.append({"url": it["image"]})
            if not res:
                for r2 in (o.get("results") or []):
                    if r2.get("url"): res.append({"url": r2["url"]})
            return {"task_status": "SUCCEEDED", "results": res}
        if st == "FAILED": raise ValueError(f"失败: {o.get('message', '未知')}")
        return {"task_status": st or "PENDING", "results": []}

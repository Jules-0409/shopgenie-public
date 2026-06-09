"""商品图工作室：AI 换背景。通义万相自动识别主体。"""

import logging
import time

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

DASHSCOPE_EDIT_BASE = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis"


async def edit_image(
    image_b64: str,
    prompt: str,
    settings: Settings,
    size: str = "1024*1024",
) -> dict:
    """Send original product photo + scene prompt to Wanx.
    The AI identifies the subject and changes the background automatically.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            DASHSCOPE_EDIT_BASE,
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
                "X-DashScope-Async": "enable",
            },
            json={
                "model": "wan2.1-t2i-turbo",
                "input": {
                    "prompt": f"{prompt}. Keep the product exactly as shown in the reference image, only change the background and scene.",
                    "ref_img": image_b64,
                },
                "parameters": {"size": size, "n": 1},
            },
        )
        response.raise_for_status()
        return response.json()


async def poll_edit_task(task_id: str, settings: Settings, max_wait: int = 90) -> dict:
    """Poll an image editing task until completion."""
    url = f"{DASHSCOPE_EDIT_BASE}/{task_id}"
    deadline = time.time() + max_wait

    async with httpx.AsyncClient(timeout=15) as client:
        while time.time() < deadline:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {settings.dashscope_api_key}"},
            )
            response.raise_for_status()
            data = response.json()
            status = data.get("output", {}).get("task_status", "")
            if status == "SUCCEEDED":
                return data
            if status == "FAILED":
                raise ValueError(f"图片编辑失败: {data.get('output', {}).get('message', '未知错误')}")
            await __import__("asyncio").sleep(2)

    raise TimeoutError("图片编辑超时")

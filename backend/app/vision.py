"""多模态能力：图片理解（Qwen-VL）+ 图片生成（通义万相）。"""
import logging
import time

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

DASHSCOPE_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
DASHSCOPE_ASYNC_BASE = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis"


async def analyze_image(image_url: str, question: str, settings: Settings) -> str:
    """Analyze an image using Qwen-VL. Returns a text description."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{DASHSCOPE_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "qwen-vl-max",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": image_url}},
                            {"type": "text", "text": question},
                        ],
                    }
                ],
            },
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def generate_image(prompt: str, settings: Settings, size: str = "1024*1024") -> dict:
    """Generate an image using 通义万相 (Wanx). Returns task info.
    This is an async API - returns task_id for polling."""
    async with httpx.AsyncClient(timeout=15) as client:
        response = await client.post(
            DASHSCOPE_ASYNC_BASE,
            headers={
                "Authorization": f"Bearer {settings.dashscope_api_key}",
                "Content-Type": "application/json",
                "X-DashScope-Async": "enable",
            },
            json={
                "model": "wanx2.1-t2i-turbo",
                "input": {"prompt": prompt},
                "parameters": {"size": size, "n": 1},
            },
        )
        response.raise_for_status()
        return response.json()


async def poll_image_task(task_id: str, settings: Settings, max_wait: int = 60) -> dict:
    """Poll an image generation task until completion."""
    url = f"{DASHSCOPE_ASYNC_BASE}/{task_id}"
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
                raise ValueError(f"图片生成失败: {data.get('output', {}).get('message', '未知错误')}")
            await __import__("asyncio").sleep(2)

    raise TimeoutError("图片生成超时")

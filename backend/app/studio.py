"""商品图工作室：抠图 + 保主体换背景。"""

import base64
import io
import logging
import time

import httpx
from PIL import Image

from app.config import Settings

logger = logging.getLogger(__name__)

DASHSCOPE_EDIT_BASE = "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis"


async def remove_background(image_bytes: bytes) -> bytes:
    """Remove background from an image using rembg. Returns PNG bytes."""
    try:
        from rembg import remove
    except ImportError:
        raise RuntimeError("rembg 未安装，请运行 pip install rembg")

    input_image = Image.open(io.BytesIO(image_bytes))
    output_image = remove(input_image)
    buf = io.BytesIO()
    output_image.save(buf, format="PNG")
    return buf.getvalue()


async def edit_image(
    reference_image_b64: str,
    prompt: str,
    settings: Settings,
    size: str = "1024*1024",
) -> dict:
    """Use Wanx image editing to generate a new scene while preserving the subject.

    Sends the reference image (background-removed product) + a scene prompt.
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
                "model": "wanx2.1-t2i-turbo",
                "input": {
                    "prompt": prompt,
                    "ref_img": reference_image_b64,
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

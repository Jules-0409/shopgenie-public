"""Studio API 回归测试：输入校验、API Key 缺失、vision content 提取。"""

from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app
from app.vision import extract_content_text


def _override_settings(api_key: str) -> None:
    app.dependency_overrides[get_settings] = lambda: Settings(
        deepseek_api_key="test", dashscope_api_key=api_key
    )


def teardown_function() -> None:
    app.dependency_overrides.clear()


def test_studio_product_rejects_empty_desc_and_image() -> None:
    _override_settings("test-key")
    with TestClient(app) as client:
        response = client.post(
            "/api/studio/generate-product", json={"base_desc": "  ", "image_b64": ""}
        )
    assert response.status_code == 422
    assert "至少提供一项" in response.json()["detail"]


def test_studio_product_requires_api_key() -> None:
    _override_settings("")
    with TestClient(app) as client:
        response = client.post(
            "/api/studio/generate-product", json={"base_desc": "保温杯", "image_b64": ""}
        )
    assert response.status_code == 503


def test_studio_adjust_requires_nonempty_fields() -> None:
    _override_settings("test-key")
    with TestClient(app) as client:
        response = client.post(
            "/api/studio/adjust-product", json={"reference_b64": "", "instructions": ""}
        )
    assert response.status_code == 422


def test_studio_scene_requires_nonempty_fields() -> None:
    _override_settings("test-key")
    with TestClient(app) as client:
        response = client.post(
            "/api/studio/generate-scene", json={"product_ref_b64": "", "prompt": ""}
        )
    assert response.status_code == 422


def test_extract_content_text_from_list() -> None:
    content = [{"text": "这是一个"}, {"image": "http://x/y.png"}, {"text": "保温杯"}]
    assert extract_content_text(content) == "这是一个保温杯"


def test_extract_content_text_passthrough_str() -> None:
    assert extract_content_text("纯文本") == "纯文本"

from pathlib import Path

from fastapi.testclient import TestClient

import app.memory as memory
import app.sessions as sessions
from app.config import Settings, get_settings
from app.main import app


def _auth_settings() -> Settings:
    return Settings(
        deepseek_api_key="test-key",
        shopgenie_auth_tokens_json='{"token-a":"merchant_a","token-b":"merchant_b"}',
    )


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_configured_auth_requires_bearer_token(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "auth.db"
    app.dependency_overrides[get_settings] = _auth_settings
    try:
        with TestClient(app) as client:
            missing = client.get("/api/products")
            invalid = client.get("/api/products", headers=_headers("bad-token"))
            ok = client.get("/api/products", headers=_headers("token-a"))
    finally:
        app.dependency_overrides.clear()

    assert missing.status_code == 401
    assert invalid.status_code == 403
    assert ok.status_code == 200


def test_login_validates_access_code_and_me_uses_bearer_token(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "auth_login.db"
    app.dependency_overrides[get_settings] = _auth_settings
    try:
        with TestClient(app) as client:
            bad = client.post("/api/auth/login", json={"access_code": "bad-token"})
            login = client.post("/api/auth/login", json={"access_code": "token-a"})
            me = client.get("/api/auth/me", headers=_headers("token-a"))
    finally:
        app.dependency_overrides.clear()

    assert bad.status_code == 401
    assert login.status_code == 200
    assert login.json() == {"user_id": "merchant_a", "token": "token-a"}
    assert me.json() == {"user_id": "merchant_a", "token": None}


def test_register_login_and_signed_token_isolate_data(tmp_path: Path) -> None:
    memory.DB_PATH = tmp_path / "accounts.db"
    app.dependency_overrides[get_settings] = lambda: Settings(
        deepseek_api_key="test-key",
        shopgenie_auth_secret="test-secret",
    )
    try:
        with TestClient(app) as client:
            registered = client.post("/api/auth/register", json={"username": "MerchantA", "password": "secret123"})
            duplicate = client.post("/api/auth/register", json={"username": "merchanta", "password": "secret123"})
            bad_login = client.post("/api/auth/login", json={"username": "merchanta", "password": "wrong123"})
            login = client.post("/api/auth/login", json={"username": "merchanta", "password": "secret123"})
            token = login.json()["token"]
            product = client.post("/api/products", headers=_headers(token), json={"name": "账号商品"})
            products = client.get("/api/products", headers=_headers(token))
            knowledge = client.get("/api/knowledge", headers=_headers(token))
    finally:
        app.dependency_overrides.clear()

    assert registered.status_code == 200
    assert registered.json()["user_id"] == "merchanta"
    assert registered.json()["token"].startswith("sg1.")
    assert duplicate.status_code == 422
    assert bad_login.status_code == 401
    assert login.status_code == 200
    assert product.status_code == 200
    assert products.json()[0]["name"] == "账号商品"
    assert any(source["title"] == "小红书内容审核红线" for source in knowledge.json())
    assert any(source["title"] == "Amazon常见违规和处罚" for source in knowledge.json())


def test_products_profiles_and_sessions_are_isolated_by_token(tmp_path: Path) -> None:
    db_path = tmp_path / "isolated.db"
    memory.DB_PATH = db_path
    sessions.DB_PATH = db_path
    app.dependency_overrides[get_settings] = _auth_settings
    try:
        with TestClient(app) as client:
            product_a = client.post("/api/products", headers=_headers("token-a"), json={"name": "A 商品"})
            product_b = client.post("/api/products", headers=_headers("token-b"), json={"name": "B 商品"})
            client.post("/api/profile", headers=_headers("token-a"), json={"brand_name": "A 品牌"})
            client.post("/api/profile", headers=_headers("token-b"), json={"brand_name": "B 品牌"})
            session_a = {
                "id": "session-a",
                "platform": "xhs",
                "title": "A 会话",
                "messages": [{"role": "user", "content": "hello"}],
            }
            client.post("/api/sessions", headers=_headers("token-a"), json=session_a)

            products_a = client.get("/api/products", headers=_headers("token-a"))
            products_b = client.get("/api/products", headers=_headers("token-b"))
            profile_a = client.get("/api/profile", headers=_headers("token-a"))
            profile_b = client.get("/api/profile", headers=_headers("token-b"))
            sessions_a = client.get("/api/sessions", headers=_headers("token-a"))
            sessions_b = client.get("/api/sessions", headers=_headers("token-b"))
            b_reads_a_session = client.get("/api/sessions/session-a", headers=_headers("token-b"))
    finally:
        app.dependency_overrides.clear()

    assert product_a.status_code == 200
    assert product_b.status_code == 200
    assert [item["name"] for item in products_a.json()] == ["A 商品"]
    assert [item["name"] for item in products_b.json()] == ["B 商品"]
    assert profile_a.json()["profile"]["brand_name"] == "A 品牌"
    assert profile_b.json()["profile"]["brand_name"] == "B 品牌"
    assert [item["title"] for item in sessions_a.json()] == ["A 会话"]
    assert sessions_b.json() == []
    assert b_reads_a_session.status_code == 404


def test_session_id_cannot_be_overwritten_by_another_user(tmp_path: Path) -> None:
    db_path = tmp_path / "session_conflict.db"
    memory.DB_PATH = db_path
    sessions.DB_PATH = db_path
    app.dependency_overrides[get_settings] = _auth_settings
    payload = {"id": "shared-id", "platform": "xhs", "title": "A 会话", "messages": []}
    try:
        with TestClient(app) as client:
            created = client.post("/api/sessions", headers=_headers("token-a"), json=payload)
            conflict = client.post(
                "/api/sessions",
                headers=_headers("token-b"),
                json={**payload, "title": "B 覆盖"},
            )
            loaded = client.get("/api/sessions/shared-id", headers=_headers("token-a"))
    finally:
        app.dependency_overrides.clear()

    assert created.status_code == 200
    assert conflict.status_code == 409
    assert loaded.json()["title"] == "A 会话"

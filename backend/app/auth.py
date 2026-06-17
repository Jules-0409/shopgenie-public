"""请求鉴权与用户隔离上下文。"""
import json
import re
from dataclasses import dataclass

from fastapi import Header, HTTPException, Depends

from app.config import Settings, get_settings

DEFAULT_OWNER_ID = "default"
USER_ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


@dataclass(frozen=True)
class CurrentUser:
    id: str


def normalize_user_id(value: str | None) -> str:
    user_id = (value or DEFAULT_OWNER_ID).strip()
    if not USER_ID_PATTERN.fullmatch(user_id):
        raise HTTPException(status_code=400, detail="用户 ID 只能包含字母、数字、下划线和短横线，长度 1-64")
    return user_id


def _load_token_map(settings: Settings) -> dict[str, str]:
    raw = (settings.shopgenie_auth_tokens_json or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="服务端鉴权配置不是合法 JSON") from exc
    if not isinstance(parsed, dict):
        raise HTTPException(status_code=500, detail="服务端鉴权配置必须是 token 到 user_id 的对象")
    token_map: dict[str, str] = {}
    for token, user_id in parsed.items():
        clean_token = str(token).strip()
        if not clean_token:
            continue
        token_map[clean_token] = normalize_user_id(str(user_id))
    return token_map


def resolve_token_user(token: str, settings: Settings) -> CurrentUser | None:
    clean = token.strip()
    if not clean:
        return None
    token_map = _load_token_map(settings)
    if token_map:
        user_id = token_map.get(clean)
        return CurrentUser(id=user_id) if user_id else None
    # 未配置生产 token 时，本地开发允许把访问码当作 user_id 使用。
    return CurrentUser(id=normalize_user_id(clean))


def get_current_user(
    authorization: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    settings: Settings = Depends(get_settings),
) -> CurrentUser:
    token_map = _load_token_map(settings)
    if token_map:
        scheme, _, token = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="缺少 Bearer 鉴权令牌")
        user = resolve_token_user(token, settings)
        if not user:
            raise HTTPException(status_code=403, detail="鉴权令牌无效")
        return user

    # 本地开发 / 单用户部署兼容：未配置 token 时允许显式开发用户头。
    return CurrentUser(id=normalize_user_id(x_user_id))

"""用户记忆系统：品牌档案 + 风格偏好，SQLite 持久化"""
import json
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path

from app.auth import DEFAULT_OWNER_ID, normalize_user_id

DB_PATH = Path(__file__).resolve().parent / "shopgenie.db"


@dataclass
class UserProfile:
    """用户品牌档案"""
    id: str = "default"
    brand_name: str = ""
    category: str = ""  # 主营品类
    target_audience: str = ""  # 目标人群
    tone: str = ""  # 品牌调性
    style_preferences: list[str] = field(default_factory=list)  # 风格偏好
    platforms: list[str] = field(default_factory=list)  # 常用平台
    taboo_words: list[str] = field(default_factory=list)  # 禁忌词
    extra_notes: str = ""  # 备注


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS user_profile (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


def get_profile(profile_id: str = "default") -> UserProfile | None:
    """获取用户档案"""
    profile_id = normalize_user_id(profile_id)
    conn = _get_connection()
    try:
        row = conn.execute("SELECT data FROM user_profile WHERE id = ?", (profile_id,)).fetchone()
        if row:
            data = json.loads(row["data"])
            return UserProfile(**data)
        return None
    finally:
        conn.close()


def save_profile(profile: UserProfile) -> None:
    """保存用户档案"""
    profile.id = normalize_user_id(profile.id)
    conn = _get_connection()
    try:
        data = json.dumps(asdict(profile), ensure_ascii=False)
        conn.execute(
            "INSERT INTO user_profile (id, data, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(id) DO UPDATE SET data = ?, updated_at = CURRENT_TIMESTAMP",
            (profile.id, data, data),
        )
        conn.commit()
    finally:
        conn.close()


def delete_profile(profile_id: str = "default") -> bool:
    """删除用户档案"""
    profile_id = normalize_user_id(profile_id or DEFAULT_OWNER_ID)
    conn = _get_connection()
    try:
        cursor = conn.execute("DELETE FROM user_profile WHERE id = ?", (profile_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def build_memory_prompt(profile: UserProfile | None) -> str:
    """将用户档案注入 Prompt"""
    if not profile:
        return ""

    parts = []
    if profile.brand_name:
        parts.append(f"品牌名：{profile.brand_name}")
    if profile.category:
        parts.append(f"主营品类：{profile.category}")
    if profile.target_audience:
        parts.append(f"目标人群：{profile.target_audience}")
    if profile.tone:
        parts.append(f"品牌调性：{profile.tone}")
    if profile.style_preferences:
        parts.append(f"风格偏好：{'、'.join(profile.style_preferences)}")
    if profile.platforms:
        parts.append(f"常用平台：{'、'.join(profile.platforms)}")
    if profile.taboo_words:
        parts.append(f"禁忌词（绝对不能出现）：{'、'.join(profile.taboo_words)}")
    if profile.extra_notes:
        parts.append(f"备注：{profile.extra_notes}")

    if not parts:
        return ""

    return "【用户品牌档案】\n" + "\n".join(parts)

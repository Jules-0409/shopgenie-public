"""会话持久化：SQLite 存储聊天会话"""
import json
import sqlite3
from dataclasses import dataclass
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "shopgenie.db"


@dataclass
class StoredSession:
    id: str
    platform: str
    title: str
    product_id: str | None
    messages: list[dict]  # Raw message dicts
    product_binding_confirmed: bool = False
    studio: dict | None = None
    created_at: str = ""
    updated_at: str = ""


def _get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            title TEXT NOT NULL DEFAULT '',
            product_id TEXT,
            product_binding_confirmed INTEGER NOT NULL DEFAULT 0,
            messages TEXT NOT NULL DEFAULT '[]',
            studio TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # migration: add studio column if missing
    try:
        conn.execute("SELECT studio FROM sessions LIMIT 0")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE sessions ADD COLUMN studio TEXT")
    try:
        conn.execute("SELECT product_binding_confirmed FROM sessions LIMIT 0")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE sessions ADD COLUMN product_binding_confirmed INTEGER NOT NULL DEFAULT 0")
    # 旧版会话的商品绑定来自自动选择第一商品，无法证明用户确认过，必须清除。
    conn.execute("UPDATE sessions SET product_id = NULL WHERE product_binding_confirmed = 0 AND product_id IS NOT NULL")
    conn.commit()
    return conn


def _parse_row(row: sqlite3.Row) -> StoredSession:
    studio = None
    try:
        raw = row["studio"]
        if raw:
            studio = json.loads(raw)
    except Exception:
        pass
    binding_confirmed = bool(row["product_binding_confirmed"])
    return StoredSession(
        id=row["id"], platform=row["platform"], title=row["title"],
        product_id=row["product_id"] if binding_confirmed else None,
        product_binding_confirmed=binding_confirmed,
        messages=json.loads(row["messages"] or "[]"),
        studio=studio,
        created_at=row["created_at"], updated_at=row["updated_at"],
    )


def list_sessions() -> list[StoredSession]:
    conn = _get_connection()
    try:
        rows = conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC").fetchall()
        return [_parse_row(row) for row in rows]
    finally:
        conn.close()


def get_session(session_id: str) -> StoredSession | None:
    conn = _get_connection()
    try:
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row:
            return _parse_row(row)
        return None
    finally:
        conn.close()


def save_session(session: StoredSession) -> None:
    conn = _get_connection()
    try:
        messages_json = json.dumps(session.messages, ensure_ascii=False)
        studio_json = json.dumps(session.studio, ensure_ascii=False) if session.studio else None
        product_id = session.product_id if session.product_binding_confirmed else None
        conn.execute(
            "INSERT INTO sessions (id, platform, title, product_id, product_binding_confirmed, messages, studio, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(id) DO UPDATE SET title=?, product_id=?, product_binding_confirmed=?, messages=?, studio=?, updated_at=CURRENT_TIMESTAMP",
            (session.id, session.platform, session.title, product_id, int(session.product_binding_confirmed), messages_json, studio_json,
             session.title, product_id, int(session.product_binding_confirmed), messages_json, studio_json),
        )
        conn.commit()
    finally:
        conn.close()


def delete_session(session_id: str) -> bool:
    conn = _get_connection()
    try:
        cursor = conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


def update_session_title(session_id: str, title: str) -> None:
    conn = _get_connection()
    try:
        conn.execute(
            "UPDATE sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (title, session_id),
        )
        conn.commit()
    finally:
        conn.close()

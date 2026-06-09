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
            messages TEXT NOT NULL DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


def list_sessions() -> list[StoredSession]:
    conn = _get_connection()
    try:
        rows = conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC").fetchall()
        return [StoredSession(
            id=row["id"], platform=row["platform"], title=row["title"],
            product_id=row["product_id"], messages=json.loads(row["messages"]),
            created_at=row["created_at"], updated_at=row["updated_at"],
        ) for row in rows]
    finally:
        conn.close()


def get_session(session_id: str) -> StoredSession | None:
    conn = _get_connection()
    try:
        row = conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
        if row:
            return StoredSession(
                id=row["id"], platform=row["platform"], title=row["title"],
                product_id=row["product_id"], messages=json.loads(row["messages"]),
                created_at=row["created_at"], updated_at=row["updated_at"],
            )
        return None
    finally:
        conn.close()


def save_session(session: StoredSession) -> None:
    conn = _get_connection()
    try:
        messages_json = json.dumps(session.messages, ensure_ascii=False)
        conn.execute(
            "INSERT INTO sessions (id, platform, title, product_id, messages, updated_at) "
            "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(id) DO UPDATE SET title=?, product_id=?, messages=?, updated_at=CURRENT_TIMESTAMP",
            (session.id, session.platform, session.title, session.product_id, messages_json,
             session.title, session.product_id, messages_json),
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

"""最小账号密码系统：注册、登录与密码哈希。"""
import hashlib
import hmac
import secrets
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime

from app import memory
from app.auth import normalize_user_id

PBKDF2_ITERATIONS = 200_000


@dataclass(frozen=True)
class Account:
    username: str
    owner_id: str


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(memory.DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS auth_accounts (
            username TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    return conn


def _normalize_username(username: str) -> str:
    return normalize_user_id(username.strip().lower())


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode(),
        bytes.fromhex(salt),
        PBKDF2_ITERATIONS,
    ).hex()


def create_account(username: str, password: str) -> Account:
    clean_username = _normalize_username(username)
    if len(password) < 6:
        raise ValueError("密码至少需要 6 位")
    salt = secrets.token_hex(16)
    password_hash = _hash_password(password, salt)
    conn = _connect()
    try:
        try:
            conn.execute(
                "INSERT INTO auth_accounts (username, owner_id, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)",
                (clean_username, clean_username, password_hash, salt, _now()),
            )
        except sqlite3.IntegrityError as exc:
            raise ValueError("账号已存在") from exc
        conn.commit()
    finally:
        conn.close()
    return Account(username=clean_username, owner_id=clean_username)


def authenticate_account(username: str, password: str) -> Account | None:
    clean_username = _normalize_username(username)
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT username, owner_id, password_hash, salt FROM auth_accounts WHERE username = ?",
            (clean_username,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return None
    candidate = _hash_password(password, row["salt"])
    if not hmac.compare_digest(candidate, row["password_hash"]):
        return None
    return Account(username=row["username"], owner_id=row["owner_id"])

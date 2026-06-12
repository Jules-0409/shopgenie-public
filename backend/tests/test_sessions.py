from pathlib import Path

import app.sessions as sessions
from app.sessions import StoredSession, get_session, save_session


def test_legacy_unconfirmed_product_binding_is_not_trusted(tmp_path: Path) -> None:
    sessions.DB_PATH = tmp_path / "sessions.db"
    save_session(StoredSession(
        id="legacy",
        platform="amazon",
        title="儿童智能手表",
        product_id="product_mask",
        product_binding_confirmed=False,
        messages=[],
    ))

    loaded = get_session("legacy")

    assert loaded is not None
    assert loaded.product_id is None
    assert loaded.product_binding_confirmed is False


def test_confirmed_product_binding_round_trip(tmp_path: Path) -> None:
    sessions.DB_PATH = tmp_path / "sessions.db"
    save_session(StoredSession(
        id="confirmed",
        platform="amazon",
        title="儿童智能手表",
        product_id="product_watch",
        product_binding_confirmed=True,
        messages=[],
    ))

    loaded = get_session("confirmed")

    assert loaded is not None
    assert loaded.product_id == "product_watch"
    assert loaded.product_binding_confirmed is True

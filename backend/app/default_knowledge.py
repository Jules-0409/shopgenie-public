"""Default platform knowledge that every merchant should start with."""

import re

from seed_knowledge import SEED_DATA

from app.auth import DEFAULT_OWNER_ID
from app.workspace import KnowledgeSource, list_knowledge_sources, save_knowledge_source


def _source_id(owner_id: str, index: int, platform: str | None) -> str:
    clean_owner = re.sub(r"[^a-zA-Z0-9_-]+", "_", owner_id or DEFAULT_OWNER_ID).strip("_")
    clean_platform = platform or "general"
    return f"seed_{clean_owner}_{clean_platform}_{index}"


def ensure_default_knowledge(owner_id: str = DEFAULT_OWNER_ID) -> int:
    """Insert missing built-in platform rules for one merchant.

    The knowledge_sources table has a global primary key, so default source IDs
    include owner_id. Existing rows are matched by rule identity to stay
    idempotent even if older seed IDs already exist.
    """
    existing = {
        (source.title, source.source_type, source.platform)
        for source in list_knowledge_sources(owner_id=owner_id)
    }
    inserted = 0
    for index, item in enumerate(SEED_DATA):
        identity = (str(item["title"]), str(item["source_type"]), item["platform"])
        if identity in existing:
            continue
        source = KnowledgeSource(
            id=_source_id(owner_id, index, item["platform"]),
            title=str(item["title"]),
            source_type=str(item["source_type"]),
            platform=item["platform"],
            content=str(item["content"]),
            url="",
        )
        save_knowledge_source(source, owner_id=owner_id)
        existing.add(identity)
        inserted += 1
    return inserted

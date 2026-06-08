import os
import tempfile

from app.memory import UserProfile, get_profile, save_profile, delete_profile, build_memory_prompt


def setup_module() -> None:
    """Use a temp DB for tests."""
    import app.memory as mem
    mem.DB_PATH = tempfile.mktemp(suffix=".db")


def teardown_module() -> None:
    import app.memory as mem
    if os.path.exists(mem.DB_PATH):
        os.unlink(mem.DB_PATH)


def test_save_and_get_profile():
    profile = UserProfile(
        id="test1",
        brand_name="测试品牌",
        category="护肤品",
        target_audience="25-35岁女性",
        tone="真实感",
        style_preferences=["不要硬广", "像朋友聊天"],
        platforms=["xhs", "dy"],
    )
    save_profile(profile)
    loaded = get_profile("test1")
    assert loaded is not None
    assert loaded.brand_name == "测试品牌"
    assert loaded.category == "护肤品"
    assert "不要硬广" in loaded.style_preferences


def test_get_nonexistent_profile():
    result = get_profile("nonexistent")
    assert result is None


def test_update_profile():
    profile = UserProfile(id="test2", brand_name="旧名字")
    save_profile(profile)
    profile.brand_name = "新名字"
    save_profile(profile)
    loaded = get_profile("test2")
    assert loaded is not None
    assert loaded.brand_name == "新名字"


def test_delete_profile():
    profile = UserProfile(id="test3", brand_name="要删的")
    save_profile(profile)
    assert delete_profile("test3") is True
    assert get_profile("test3") is None


def test_delete_nonexistent():
    assert delete_profile("nope") is False


def test_build_memory_prompt_full():
    profile = UserProfile(
        brand_name="XX美妆",
        category="护肤品",
        target_audience="25-35岁女性",
        tone="真实感",
        style_preferences=["不要硬广"],
        platforms=["xhs"],
        taboo_words=["最好", "第一"],
    )
    prompt = build_memory_prompt(profile)
    assert "XX美妆" in prompt
    assert "护肤品" in prompt
    assert "不要硬广" in prompt
    assert "最好" in prompt


def test_build_memory_prompt_empty():
    profile = UserProfile()
    prompt = build_memory_prompt(profile)
    assert prompt == ""


def test_build_memory_prompt_none():
    prompt = build_memory_prompt(None)
    assert prompt == ""

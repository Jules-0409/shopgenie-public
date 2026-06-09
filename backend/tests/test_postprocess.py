from app.postprocess import check_banned_words, check_platform_rules, post_process
from app.schemas import ContentSection, GeneratedContent, Platform


def make_content(platform: Platform, title: str = "测试标题", body: str = "测试正文", tags: list[str] | None = None) -> GeneratedContent:
    return GeneratedContent(platform=platform, title=title, body=body, tags=tags or [], sections=[])


def test_banned_word_detection():
    content = make_content(Platform.XHS, title="这个面膜最好用", body="纯天然成分，一次见效")
    result = check_banned_words(content)
    assert len(result.banned_words_found) >= 2
    assert any("最好用" in w for w in result.banned_words_found)
    assert any("纯天然" in w or "一次见效" in w for w in result.banned_words_found)


def test_platform_banned_words_xhs():
    content = make_content(Platform.XHS, title="必买推荐", body="加微信了解")
    result = check_banned_words(content)
    assert any("必买" in w for w in result.banned_words_found)


def test_platform_rules_xhs_hard_sell():
    content = make_content(Platform.XHS, body="赶紧下单，链接评论区，加微信")
    result = check_platform_rules(content)
    assert len(result.warnings) > 0


def test_no_banned_words():
    content = make_content(Platform.XHS, title="姐妹们分享一个好用的面膜", body="补水效果不错，推荐给干皮姐妹")
    result = post_process(content)
    assert len(result.banned_words_found) == 0


def test_amazon_banned_words():
    content = make_content(Platform.AMAZON, title="Best product guaranteed", body="Miracle cure for all")
    result = check_banned_words(content)
    assert len(result.banned_words_found) >= 2


def test_custom_brand_banned_words():
    content = make_content(Platform.XHS, body="这款产品主打速效焕肤")
    result = post_process(content, ["速效"])
    assert "速效" in result.banned_words_found
    assert any("品牌禁忌词" in warning for warning in result.warnings)

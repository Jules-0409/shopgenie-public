import httpx
import pytest

from app.knowledge_fetch import PageTextParser, fetch_public_page, validate_public_url


def test_page_parser_extracts_title_and_skips_scripts() -> None:
    parser = PageTextParser()
    parser.feed("<html><title>平台规则</title><body><script>secret()</script><main>避免夸大宣传</main></body></html>")
    assert parser.title == "平台规则"
    assert parser.parts == ["避免夸大宣传"]


@pytest.mark.asyncio
async def test_validate_public_url_rejects_private_address() -> None:
    with pytest.raises(ValueError, match="内网"):
        await validate_public_url("http://127.0.0.1/private")


@pytest.mark.asyncio
async def test_fetch_public_page_extracts_html(monkeypatch) -> None:
    async def allow(url: str) -> str:
        return url

    monkeypatch.setattr("app.knowledge_fetch.validate_public_url", allow)
    transport = httpx.MockTransport(lambda request: httpx.Response(
        200,
        headers={"content-type": "text/html"},
        text="<title>官方规则</title><article>标题不要使用绝对化词语</article>",
    ))
    async with httpx.AsyncClient(transport=transport) as client:
        title, content = await fetch_public_page("https://example.com/rules", client)

    assert title == "官方规则"
    assert "绝对化词语" in content

import httpx
import pytest

from app.web_search import SearchParser, needs_web_discovery, search_public_web


def test_search_trigger_is_explicit() -> None:
    assert needs_web_discovery("帮我查一下最新平台规则")
    assert not needs_web_discovery("帮我写一篇笔记")


def test_search_parser_extracts_public_result() -> None:
    parser = SearchParser()
    parser.feed('<a class="result__a" href="https://example.com/rule">官方规则</a>')
    assert parser.results == [("官方规则", "https://example.com/rule", "")]


@pytest.mark.asyncio
async def test_search_public_web_has_result_limit() -> None:
    html = "".join(f'<a class="result__a" href="https://example.com/{index}">规则 {index}</a>' for index in range(10))
    transport = httpx.MockTransport(lambda request: httpx.Response(200, text=html))
    async with httpx.AsyncClient(transport=transport) as client:
        results = await search_public_web("平台规则", client)
    assert len(results) == 5

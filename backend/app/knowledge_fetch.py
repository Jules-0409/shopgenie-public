"""安全抓取公开网页，转换为可引用的知识来源。"""
import ipaddress
import socket
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx
from starlette.concurrency import run_in_threadpool


class PageTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.parts: list[str] = []
        self._in_title = False
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        if tag in {"script", "style", "noscript", "svg"}:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag in {"script", "style", "noscript", "svg"} and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        clean = " ".join(data.split())
        if not clean or self._skip_depth:
            return
        if self._in_title:
            self.title = f"{self.title} {clean}".strip()
        else:
            self.parts.append(clean)


async def validate_public_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("仅支持公开 HTTP/HTTPS 网页")
    if parsed.username or parsed.password:
        raise ValueError("网址不能包含账号信息")
    addresses = await run_in_threadpool(socket.getaddrinfo, parsed.hostname, parsed.port or 443)
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("不能抓取本机或内网地址")
    return url


async def fetch_public_page(url: str, client: httpx.AsyncClient | None = None) -> tuple[str, str]:
    await validate_public_url(url)
    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=10, follow_redirects=False)
    try:
        response = await http.get(url, headers={"User-Agent": "ShopGenie-Knowledge/1.0"})
        response.raise_for_status()
        if len(response.content) > 1_000_000:
            raise ValueError("网页内容超过 1MB 上限")
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type and "text/plain" not in content_type:
            raise ValueError("仅支持 HTML 或纯文本网页")
        if "text/plain" in content_type:
            return parsed_title(url), response.text[:10000]
        parser = PageTextParser()
        parser.feed(response.text)
        text = "\n".join(parser.parts)
        if not text.strip():
            raise ValueError("网页没有可提取的正文")
        return (parser.title or parsed_title(url))[:200], text[:10000]
    finally:
        if owns_client:
            await http.aclose()


def parsed_title(url: str) -> str:
    return urlparse(url).hostname or "网页资料"

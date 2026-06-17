"""有界公开网页发现，用于最新规则、趋势与竞品资料候选。"""
from html.parser import HTMLParser
from urllib.parse import parse_qs, quote_plus, unquote, urlparse

import httpx
from starlette.concurrency import run_in_threadpool

from app.auth import DEFAULT_OWNER_ID
from app.schemas import Platform
from app.workspace import KnowledgeSource, save_knowledge_source

MAX_RESULTS = 5
SEARCH_TRIGGERS = ("最新", "竞品", "趋势", "平台规则", "搜索", "查一下", "调研")


class SearchParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.results: list[tuple[str, str, str]] = []
        self._href = ""
        self._title = ""
        self._snippet = ""
        self._capture_title = False
        self._capture_snippet = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        classes = attrs_dict.get("class", "") or ""
        if tag == "a" and "result__a" in classes:
            self._href = attrs_dict.get("href", "") or ""
            self._title = ""
            self._capture_title = True
        elif "result__snippet" in classes:
            self._snippet = ""
            self._capture_snippet = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._capture_title:
            self._capture_title = False
            self._append_if_ready()
        elif self._capture_snippet and tag in {"a", "div", "span"}:
            self._capture_snippet = False
            self._append_if_ready()

    def handle_data(self, data: str) -> None:
        clean = " ".join(data.split())
        if self._capture_title:
            self._title = f"{self._title} {clean}".strip()
        if self._capture_snippet:
            self._snippet = f"{self._snippet} {clean}".strip()

    def _append_if_ready(self) -> None:
        if not self._href or not self._title:
            return
        url = unwrap_url(self._href)
        if url.startswith(("http://", "https://")) and not any(existing[1] == url for existing in self.results):
            self.results.append((self._title[:200], url, self._snippet[:1000]))
        self._href = ""
        self._title = ""
        self._snippet = ""


def unwrap_url(url: str) -> str:
    parsed = urlparse(url)
    target = parse_qs(parsed.query).get("uddg", [""])[0]
    return unquote(target) if target else url


def needs_web_discovery(message: str) -> bool:
    return any(trigger in message for trigger in SEARCH_TRIGGERS)


async def search_public_web(query: str, client: httpx.AsyncClient | None = None) -> list[tuple[str, str, str]]:
    owns_client = client is None
    http = client or httpx.AsyncClient(timeout=10, follow_redirects=False)
    try:
        response = await http.get(
            f"https://html.duckduckgo.com/html/?q={quote_plus(query[:300])}",
            headers={"User-Agent": "ShopGenie-Research/1.0"},
        )
        response.raise_for_status()
        if len(response.content) > 1_000_000:
            raise ValueError("搜索结果超过 1MB 上限")
        parser = SearchParser()
        parser.feed(response.text)
        return parser.results[:MAX_RESULTS]
    finally:
        if owns_client:
            await http.aclose()


def evaluate_credibility(url: str, platform_value: str) -> str:
    """根据域名与平台判断网页的可信度评级，返回加粗标识前缀。"""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
    except Exception:
        return "【未验证】"
    
    # 各平台官方域名定义
    official_domains = {
        "xhs": ["xiaohongshu.com", "rednote.cn", "xhslink.com"],
        "dy": ["douyin.com", "bytedance.com", "oceanengine.com"],
        "amazon": ["amazon.com", "amazon.cn", "amazonservices.com", "sellercentral.amazon.com"]
    }
    
    # 优先匹配指定平台的官方渠道
    for k, domains in official_domains.items():
        if any(d in domain or domain.endswith("." + d) for d in domains):
            if k == platform_value:
                return "【官方认证】"
            else:
                return "【跨平台官方】"
                
    # 高可信度通用后缀
    high_credibility = ["gov.cn", "edu.cn", "wikipedia.org", "w3.org"]
    if any(d in domain or domain.endswith("." + d) for d in high_credibility):
        return "【高可信度】"
        
    # 主流行业媒体或社区
    medium_credibility = [
        "36kr.com", "sspai.com", "huxiu.com", "ithome.com", "zhihu.com",
        "csdn.net", "github.com", "sohu.com", "sinajs.cn"
    ]
    if any(d in domain or domain.endswith("." + d) for d in medium_credibility):
        return "【媒体报道】"
        
    return "【第三方网页】"


async def discover_knowledge(query: str, platform: Platform, owner_id: str = DEFAULT_OWNER_ID) -> list[KnowledgeSource]:
    results = await search_public_web(query)
    sources = []
    for title, url, snippet in results:
        credibility_tag = evaluate_credibility(url, platform.value)
        source = KnowledgeSource(
            title=f"{credibility_tag}{title}",
            source_type="web_search",
            platform=platform.value,
            content=snippet or f"公开网页候选：{title}",
            url=url,
        )
        sources.append(await run_in_threadpool(save_knowledge_source, source, owner_id))
    return sources

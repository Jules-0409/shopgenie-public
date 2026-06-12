import os
from pathlib import Path
from fastapi.testclient import TestClient
import app.memory as memory
import app.workspace as workspace
from app.main import app
from app.web_search import evaluate_credibility


def test_evaluate_credibility() -> None:
    # Official XHS domains
    assert evaluate_credibility("https://xiaohongshu.com/discovery", "xhs") == "【官方认证】"
    assert evaluate_credibility("https://sns.xiaohongshu.com/some/path", "xhs") == "【官方认证】"
    assert evaluate_credibility("https://rednote.cn/about", "xhs") == "【官方认证】"
    
    # Cross platform official domains
    assert evaluate_credibility("https://xiaohongshu.com/discovery", "dy") == "【跨平台官方】"
    
    # Official Amazon domains
    assert evaluate_credibility("https://sellercentral.amazon.com/gp/homepage.html", "amazon") == "【官方认证】"
    
    # High credibility domains
    assert evaluate_credibility("https://m.gov.cn/news", "xhs") == "【高可信度】"
    assert evaluate_credibility("https://tsinghua.edu.cn/page", "dy") == "【高可信度】"
    
    # Media/Tech reporting domains
    assert evaluate_credibility("https://36kr.com/p/123", "xhs") == "【媒体报道】"
    assert evaluate_credibility("https://sspai.com/post/456", "dy") == "【媒体报道】"
    
    # Third party / Unverified
    assert evaluate_credibility("https://blog.myrandomsite.com/hello", "xhs") == "【第三方网页】"

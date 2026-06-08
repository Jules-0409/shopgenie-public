from enum import StrEnum

from pydantic import BaseModel, Field


class Platform(StrEnum):
    XHS = "xhs"
    DOUYIN = "dy"
    AMAZON = "amazon"


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    platform: Platform
    message: str = Field(min_length=1, max_length=500)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


class Usage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


class ContentSection(BaseModel):
    label: str = Field(min_length=1, max_length=80)
    content: str = Field(min_length=1, max_length=2000)


class GeneratedContent(BaseModel):
    platform: Platform
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=8000)
    tags: list[str] = Field(default_factory=list, max_length=20)
    sections: list[ContentSection] = Field(default_factory=list, max_length=12)


class ChatResponse(BaseModel):
    message: str
    result: GeneratedContent | None = None
    model: str
    usage: Usage

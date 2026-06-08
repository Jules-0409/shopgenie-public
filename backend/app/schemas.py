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


class ChatResponse(BaseModel):
    message: str
    model: str
    usage: Usage

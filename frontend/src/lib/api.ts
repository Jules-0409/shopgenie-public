import type { Platform } from './platforms';

interface ApiHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatApiResponse {
  message: string;
  result: GeneratedContent | null;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ContentSection {
  label: string;
  content: string;
}

export interface GeneratedContent {
  platform: Platform;
  title: string;
  body: string;
  tags: string[];
  sections: ContentSection[];
}

export async function sendChat(
  platform: Platform,
  message: string,
  history: ApiHistoryMessage[],
): Promise<ChatApiResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, message, history }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? '生成失败，请稍后重试');
  }
  return response.json() as Promise<ChatApiResponse>;
}

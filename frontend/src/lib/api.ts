import type { Platform } from './platforms';

interface ApiHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QualityReport {
  score: number;
  checks: { name: string; passed: boolean; detail: string }[];
  suggestions: string[];
}

interface ChatApiResponse {
  message: string;
  result: GeneratedContent | null;
  questions: { question: string; options: string[] }[] | null;
  warnings: string[] | null;
  conversation_title: string | null;
  model: string;
  asset_id: string | null;
  quality: QualityReport | null;
  task_id: string | null;
  sources: { id: string; title: string; url: string }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface Product {
  id: string;
  name: string;
  category: string;
  audience: string;
  selling_points: string[];
  facts: string[];
  prohibited_claims: string[];
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ContentAsset {
  id: string;
  product_id: string | null;
  platform: Platform;
  name: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ContentVersion {
  id: string;
  asset_id: string;
  version: number;
  content: GeneratedContent;
  quality: QualityReport;
  change_note: string;
  created_at: string;
}

export interface KnowledgeSource {
  id: string;
  title: string;
  source_type: string;
  platform: Platform | null;
  content: string;
  url: string;
  updated_at: string;
}

export interface AgentTask {
  id: string;
  objective: string;
  status: string;
  steps: { name: string; status: string }[];
  result_summary: string;
  created_at: string;
}

export interface PerformanceRecord {
  id: string;
  asset_id: string;
  platform: Platform;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes: string;
  recorded_at: string;
}

export interface PerformanceInsights {
  records: number;
  impressions: number;
  conversions: number;
  conversion_rate: number;
  summary: string;
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

export interface UserProfile {
  brand_name: string;
  category: string;
  target_audience: string;
  tone: string;
  style_preferences: string[];
  platforms: Platform[];
  taboo_words: string[];
  extra_notes: string;
}

export const EMPTY_PROFILE: UserProfile = {
  brand_name: '',
  category: '',
  target_audience: '',
  tone: '',
  style_preferences: [],
  platforms: [],
  taboo_words: [],
  extra_notes: '',
};

export async function getProfile(): Promise<UserProfile | null> {
  const response = await fetch('/api/profile');
  if (!response.ok) throw new Error('品牌档案加载失败');
  const data = await response.json() as { profile: UserProfile | null };
  return data.profile;
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const response = await fetch('/api/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? '品牌档案保存失败');
  }
  const data = await response.json() as { profile: UserProfile };
  return data.profile;
}

export interface StreamEvent {
  event: 'status' | 'token' | 'result' | 'error' | 'done';
  data: Record<string, unknown>;
}

export async function* sendChatStream(
  platform: Platform,
  message: string,
  history: ApiHistoryMessage[],
  productId?: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, message, history, product_id: productId || null }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? '生成失败，请稍后重试');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取流');
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      let currentEvent = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          try {
            const data = JSON.parse(raw) as Record<string, unknown>;
            yield { event: currentEvent as StreamEvent['event'], data };
          } catch { /* skip malformed */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function sendChat(
  platform: Platform,
  message: string,
  history: ApiHistoryMessage[],
  productId?: string,
  signal?: AbortSignal,
): Promise<ChatApiResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, message, history, product_id: productId || null }),
    signal,
  });

  if (!response.ok) {
    if (response.status === 0) throw new Error('已停止生成');
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? '生成失败，请稍后重试');
  }
  return response.json() as Promise<ChatApiResponse>;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? '请求失败');
  }
  return response.json() as Promise<T>;
}

export const listProducts = () => requestJson<Product[]>('/api/products');
export const createProduct = (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => requestJson<Product>('/api/products', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
});
export const listContentAssets = () => requestJson<ContentAsset[]>('/api/content');
export const listContentVersions = (assetId: string) => requestJson<ContentVersion[]>(`/api/content/${assetId}/versions`);
export const addContentVersion = (assetId: string, content: GeneratedContent, changeNote: string) => requestJson<ContentVersion>(`/api/content/${assetId}/versions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, change_note: changeNote }),
});
export const reviseContent = (assetId: string, instruction: string) => requestJson<ContentVersion>(`/api/content/${assetId}/revise`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction }),
});
export const listKnowledge = () => requestJson<KnowledgeSource[]>('/api/knowledge');
export const createKnowledge = (source: Omit<KnowledgeSource, 'id' | 'updated_at'>) => requestJson<KnowledgeSource>('/api/knowledge', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(source),
});
export const importKnowledge = (url: string, platform: Platform) => requestJson<KnowledgeSource>('/api/knowledge/import', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, platform }),
});
export const discoverKnowledge = (query: string, platform: Platform) => requestJson<KnowledgeSource[]>('/api/knowledge/discover', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, platform }),
});
export const listTasks = () => requestJson<AgentTask[]>('/api/tasks');
export const runAgentTask = (objective: string, assetId: string) => requestJson<{ task: AgentTask; version: ContentVersion }>('/api/tasks/run', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objective, asset_id: assetId }),
});
export const listPerformance = () => requestJson<PerformanceRecord[]>('/api/performance');
export const getPerformanceInsights = () => requestJson<PerformanceInsights>('/api/performance/insights');
export const createPerformance = (record: Omit<PerformanceRecord, 'id' | 'recorded_at'>) => requestJson<PerformanceRecord>('/api/performance', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
});

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

export interface ReviewInsights {
  loved_points: string[];
  pain_points: string[];
  avoid_phrases: string[];
  voice_quotes: string[];
  summary: string;
  review_count: number;
}

export interface ExperimentVariant {
  label: string;
  title: string;
  hook: string;
  angle: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface Experiment {
  id: string;
  product_id: string | null;
  platform: Platform;
  name: string;
  brief: string;
  variants: ExperimentVariant[];
  status: 'running' | 'decided';
  winner_label: string | null;
  created_at: string;
  updated_at: string;
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
  review_insights?: ReviewInsights | null;
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
  const response = await fetch('/shopgenie/api/profile');
  if (!response.ok) throw new Error('品牌档案加载失败');
  const data = await response.json() as { profile: UserProfile | null };
  return data.profile;
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  const response = await fetch('/shopgenie/api/profile', {
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
  imageUrl?: string,
): AsyncGenerator<StreamEvent> {
  const response = await fetch('/shopgenie/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform, message, history, product_id: productId || null, image_url: imageUrl || null }),
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
  const response = await fetch('/shopgenie/api/chat', {
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

export const listProducts = () => requestJson<Product[]>('/shopgenie/api/products');
export const createProduct = (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => requestJson<Product>('/shopgenie/api/products', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
});
export const analyzeReviews = (productId: string, reviews: string) => requestJson<Product>(`/shopgenie/api/products/${productId}/reviews/analyze`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviews }),
});
export const clearReviews = (productId: string) => requestJson<Product>(`/shopgenie/api/products/${productId}/reviews`, { method: 'DELETE' });
export const listExperiments = (productId?: string | null) => requestJson<Experiment[]>(`/shopgenie/api/experiments${productId ? `?product_id=${encodeURIComponent(productId)}` : ''}`);
export const generateExperiment = (input: { product_id: string | null; platform: Platform; brief: string; n?: number }) => requestJson<Experiment>('/shopgenie/api/experiments/generate', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
export const recordVariantMetrics = (experimentId: string, m: { label: string; impressions: number; clicks: number; conversions: number }) => requestJson<Experiment>(`/shopgenie/api/experiments/${experimentId}/metrics`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m),
});
export const deleteExperiment = (experimentId: string) => requestJson<{ deleted: boolean }>(`/shopgenie/api/experiments/${experimentId}`, { method: 'DELETE' });
export const listContentAssets = () => requestJson<ContentAsset[]>('/shopgenie/api/content');
export const listContentVersions = (assetId: string) => requestJson<ContentVersion[]>(`/shopgenie/api/content/${assetId}/versions`);
export const addContentVersion = (assetId: string, content: GeneratedContent, changeNote: string) => requestJson<ContentVersion>(`/shopgenie/api/content/${assetId}/versions`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, change_note: changeNote }),
});
export const reviseContent = (assetId: string, instruction: string) => requestJson<ContentVersion>(`/shopgenie/api/content/${assetId}/revise`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction }),
});
export const listKnowledge = () => requestJson<KnowledgeSource[]>('/shopgenie/api/knowledge');
export const createKnowledge = (source: Omit<KnowledgeSource, 'id' | 'updated_at'>) => requestJson<KnowledgeSource>('/shopgenie/api/knowledge', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(source),
});
export const importKnowledge = (url: string, platform: Platform) => requestJson<KnowledgeSource>('/shopgenie/api/knowledge/import', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, platform }),
});
export const discoverKnowledge = (query: string, platform: Platform) => requestJson<KnowledgeSource[]>('/shopgenie/api/knowledge/discover', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, platform }),
});
export const listTasks = () => requestJson<AgentTask[]>('/shopgenie/api/tasks');
export const runAgentTask = (objective: string, assetId: string) => requestJson<{ task: AgentTask; version: ContentVersion }>('/shopgenie/api/tasks/run', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objective, asset_id: assetId }),
});
export const listPerformance = () => requestJson<PerformanceRecord[]>('/shopgenie/api/performance');
export const getPerformanceInsights = () => requestJson<PerformanceInsights>('/shopgenie/api/performance/insights');
export const createPerformance = (record: Omit<PerformanceRecord, 'id' | 'recorded_at'>) => requestJson<PerformanceRecord>('/shopgenie/api/performance', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
});

export interface StoredSession {
  id: string;
  platform: Platform;
  title: string;
  product_id: string | null;
  messages: Record<string, unknown>[];
  studio?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const listStoredSessions = () => requestJson<StoredSession[]>('/shopgenie/api/sessions');
export const getStoredSession = (id: string) => requestJson<StoredSession>(`/shopgenie/api/sessions/${id}`);
export const saveStoredSession = (session: Omit<StoredSession, 'created_at' | 'updated_at'>) => requestJson<StoredSession>('/shopgenie/api/sessions', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session),
});
export const deleteStoredSession = (id: string) => requestJson<{ deleted: boolean }>(`/shopgenie/api/sessions/${id}`, { method: 'DELETE' });

// --- Vision / Image Generation ---

export interface ImageTemplate {
  id: string;
  name: string;
  description: string;
  aspect_ratio: string;
  tags: string[];
  prompt_template?: string;
  builtin?: boolean;
}

export interface DesignTemplates {
  templates: ImageTemplate[];
  categories: Record<string, { name: string; template_ids: string[] }>;
  platform_sizes: Record<string, string>;
}

export const getDesignTemplates = () => requestJson<DesignTemplates>('/shopgenie/api/studio/templates');

export const createCustomTemplate = (data: {
  name: string; description: string; prompt_template: string;
  aspect_ratio?: string; tags?: string[]; category?: string; category_name?: string;
}) => requestJson<ImageTemplate>('/shopgenie/api/studio/templates/custom', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

export const deleteCustomTemplate = (id: string) =>
  requestJson<{ deleted: boolean }>(`/shopgenie/api/studio/templates/custom/${id}`, { method: 'DELETE' });

export const generateImage = (prompt: string, size: string = '1024*1024') =>
  requestJson<{ task_id: string; status: string }>('/shopgenie/api/vision/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, size }),
  });

export interface ImageTaskResult {
  output: {
    task_id: string;
    task_status: string;
    results?: Array<{ url: string }>;
  };
}

export const pollImageTask = (taskId: string) =>
  requestJson<ImageTaskResult>(`/shopgenie/api/vision/generate/${taskId}`);

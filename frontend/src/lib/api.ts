1|import type { Platform } from './platforms';
2|
3|interface ApiHistoryMessage {
4|  role: 'user' | 'assistant';
5|  content: string;
6|}
7|
8|export interface QualityReport {
9|  score: number;
10|  checks: { name: string; passed: boolean; detail: string }[];
11|  suggestions: string[];
12|}
13|
14|interface ChatApiResponse {
15|  message: string;
16|  result: GeneratedContent | null;
17|  questions: { question: string; options: string[] }[] | null;
18|  warnings: string[] | null;
19|  conversation_title: string | null;
20|  model: string;
21|  asset_id: string | null;
22|  quality: QualityReport | null;
23|  task_id: string | null;
24|  sources: { id: string; title: string; url: string }[];
25|  usage: {
26|    prompt_tokens: number;
27|    completion_tokens: number;
28|    total_tokens: number;
29|  };
30|}
31|
32|export interface Product {
33|  id: string;
34|  name: string;
35|  category: string;
36|  audience: string;
37|  selling_points: string[];
38|  facts: string[];
39|  prohibited_claims: string[];
40|  notes: string;
41|  created_at: string;
42|  updated_at: string;
43|}
44|
45|export interface ContentAsset {
46|  id: string;
47|  product_id: string | null;
48|  platform: Platform;
49|  name: string;
50|  current_version: number;
51|  created_at: string;
52|  updated_at: string;
53|}
54|
55|export interface ContentVersion {
56|  id: string;
57|  asset_id: string;
58|  version: number;
59|  content: GeneratedContent;
60|  quality: QualityReport;
61|  change_note: string;
62|  created_at: string;
63|}
64|
65|export interface KnowledgeSource {
66|  id: string;
67|  title: string;
68|  source_type: string;
69|  platform: Platform | null;
70|  content: string;
71|  url: string;
72|  updated_at: string;
73|}
74|
75|export interface AgentTask {
76|  id: string;
77|  objective: string;
78|  status: string;
79|  steps: { name: string; status: string }[];
80|  result_summary: string;
81|  created_at: string;
82|}
83|
84|export interface PerformanceRecord {
85|  id: string;
86|  asset_id: string;
87|  platform: Platform;
88|  impressions: number;
89|  engagements: number;
90|  clicks: number;
91|  conversions: number;
92|  revenue: number;
93|  notes: string;
94|  recorded_at: string;
95|}
96|
97|export interface PerformanceInsights {
98|  records: number;
99|  impressions: number;
100|  conversions: number;
101|  conversion_rate: number;
102|  summary: string;
103|}
104|
105|export interface ContentSection {
106|  label: string;
107|  content: string;
108|}
109|
110|export interface GeneratedContent {
111|  platform: Platform;
112|  title: string;
113|  body: string;
114|  tags: string[];
115|  sections: ContentSection[];
116|}
117|
118|export interface UserProfile {
119|  brand_name: string;
120|  category: string;
121|  target_audience: string;
122|  tone: string;
123|  style_preferences: string[];
124|  platforms: Platform[];
125|  taboo_words: string[];
126|  extra_notes: string;
127|}
128|
129|export const EMPTY_PROFILE: UserProfile = {
130|  brand_name: '',
131|  category: '',
132|  target_audience: '',
133|  tone: '',
134|  style_preferences: [],
135|  platforms: [],
136|  taboo_words: [],
137|  extra_notes: '',
138|};
139|
140|export async function getProfile(): Promise<UserProfile | null> {
141|  const response = await fetch('/shopgenie/api/profile');
142|  if (!response.ok) throw new Error('品牌档案加载失败');
143|  const data = await response.json() as { profile: UserProfile | null };
144|  return data.profile;
145|}
146|
147|export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
148|  const response = await fetch('/shopgenie/api/profile', {
149|    method: 'POST',
150|    headers: { 'Content-Type': 'application/json' },
151|    body: JSON.stringify(profile),
152|  });
153|  if (!response.ok) {
154|    const body = await response.json().catch(() => null) as { detail?: string } | null;
155|    throw new Error(body?.detail ?? '品牌档案保存失败');
156|  }
157|  const data = await response.json() as { profile: UserProfile };
158|  return data.profile;
159|}
160|
161|export interface StreamEvent {
162|  event: 'status' | 'token' | 'result' | 'error' | 'done';
163|  data: Record<string, unknown>;
164|}
165|
166|export async function* sendChatStream(
167|  platform: Platform,
168|  message: string,
169|  history: ApiHistoryMessage[],
170|  productId?: string,
171|  signal?: AbortSignal,
172|): AsyncGenerator<StreamEvent> {
173|  const response = await fetch('/shopgenie/api/chat/stream', {
174|    method: 'POST',
175|    headers: { 'Content-Type': 'application/json' },
176|    body: JSON.stringify({ platform, message, history, product_id: productId || null }),
177|    signal,
178|  });
179|
180|  if (!response.ok) {
181|    const body = await response.json().catch(() => null) as { detail?: string } | null;
182|    throw new Error(body?.detail ?? '生成失败，请稍后重试');
183|  }
184|
185|  const reader = response.body?.getReader();
186|  if (!reader) throw new Error('无法读取流');
187|  const decoder = new TextDecoder();
188|  let buffer = '';
189|
190|  try {
191|    while (true) {
192|      const { done, value } = await reader.read();
193|      if (done) break;
194|      buffer += decoder.decode(value, { stream: true });
195|      const lines = buffer.split('\n');
196|      buffer = lines.pop() ?? '';
197|
198|      let currentEvent = '';
199|      for (const line of lines) {
200|        if (line.startsWith('event: ')) {
201|          currentEvent = line.slice(7).trim();
202|        } else if (line.startsWith('data: ')) {
203|          const raw = line.slice(6);
204|          try {
205|            const data = JSON.parse(raw) as Record<string, unknown>;
206|            yield { event: currentEvent as StreamEvent['event'], data };
207|          } catch { /* skip malformed */ }
208|        }
209|      }
210|    }
211|  } finally {
212|    reader.releaseLock();
213|  }
214|}
215|
216|export async function sendChat(
217|  platform: Platform,
218|  message: string,
219|  history: ApiHistoryMessage[],
220|  productId?: string,
221|  signal?: AbortSignal,
222|): Promise<ChatApiResponse> {
223|  const response = await fetch('/shopgenie/api/chat', {
224|    method: 'POST',
225|    headers: { 'Content-Type': 'application/json' },
226|    body: JSON.stringify({ platform, message, history, product_id: productId || null }),
227|    signal,
228|  });
229|
230|  if (!response.ok) {
231|    if (response.status === 0) throw new Error('已停止生成');
232|    const body = await response.json().catch(() => null) as { detail?: string } | null;
233|    throw new Error(body?.detail ?? '生成失败，请稍后重试');
234|  }
235|  return response.json() as Promise<ChatApiResponse>;
236|}
237|
238|async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
239|  const response = await fetch(url, init);
240|  if (!response.ok) {
241|    const body = await response.json().catch(() => null) as { detail?: string } | null;
242|    throw new Error(body?.detail ?? '请求失败');
243|  }
244|  return response.json() as Promise<T>;
245|}
246|
247|export const listProducts = () => requestJson<Product[]>('/api/products');
248|export const createProduct = (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => requestJson<Product>('/api/products', {
249|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(product),
250|});
251|export const listContentAssets = () => requestJson<ContentAsset[]>('/api/content');
252|export const listContentVersions = (assetId: string) => requestJson<ContentVersion[]>(`/shopgenie/api/content/${assetId}/versions`);
253|export const addContentVersion = (assetId: string, content: GeneratedContent, changeNote: string) => requestJson<ContentVersion>(`/shopgenie/api/content/${assetId}/versions`, {
254|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, change_note: changeNote }),
255|});
256|export const reviseContent = (assetId: string, instruction: string) => requestJson<ContentVersion>(`/shopgenie/api/content/${assetId}/revise`, {
257|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instruction }),
258|});
259|export const listKnowledge = () => requestJson<KnowledgeSource[]>('/api/knowledge');
260|export const createKnowledge = (source: Omit<KnowledgeSource, 'id' | 'updated_at'>) => requestJson<KnowledgeSource>('/api/knowledge', {
261|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(source),
262|});
263|export const importKnowledge = (url: string, platform: Platform) => requestJson<KnowledgeSource>('/api/knowledge/import', {
264|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, platform }),
265|});
266|export const discoverKnowledge = (query: string, platform: Platform) => requestJson<KnowledgeSource[]>('/api/knowledge/discover', {
267|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, platform }),
268|});
269|export const listTasks = () => requestJson<AgentTask[]>('/api/tasks');
270|export const runAgentTask = (objective: string, assetId: string) => requestJson<{ task: AgentTask; version: ContentVersion }>('/api/tasks/run', {
271|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ objective, asset_id: assetId }),
272|});
273|export const listPerformance = () => requestJson<PerformanceRecord[]>('/api/performance');
274|export const getPerformanceInsights = () => requestJson<PerformanceInsights>('/api/performance/insights');
275|export const createPerformance = (record: Omit<PerformanceRecord, 'id' | 'recorded_at'>) => requestJson<PerformanceRecord>('/api/performance', {
276|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
277|});
278|
279|export interface StoredSession {
280|  id: string;
281|  platform: Platform;
282|  title: string;
283|  product_id: string | null;
284|  messages: Record<string, unknown>[];
285|  created_at: string;
286|  updated_at: string;
287|}
288|
289|export const listStoredSessions = () => requestJson<StoredSession[]>('/api/sessions');
290|export const getStoredSession = (id: string) => requestJson<StoredSession>(`/shopgenie/api/sessions/${id}`);
291|export const saveStoredSession = (session: Omit<StoredSession, 'created_at' | 'updated_at'>) => requestJson<StoredSession>('/api/sessions', {
292|  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session),
293|});
294|export const deleteStoredSession = (id: string) => requestJson<{ deleted: boolean }>(`/shopgenie/api/sessions/${id}`, { method: 'DELETE' });
295|
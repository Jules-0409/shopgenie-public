'use client';
import { useEffect, useRef, useState } from 'react';
import type { ImageTemplate, DesignTemplates } from '@/lib/api';
import { getDesignTemplates, getUserIdHeader } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Platform } from '@/lib/platforms';
import type { Conversation } from '@/hooks/useChat';
import type { Message } from '@/components/ChatBubble';

async function apiPost(url: string, body: Record<string, unknown>) {
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserIdHeader()
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: '请求失败' })); throw new Error((e as { detail?: string }).detail ?? '请求失败'); }
  return r.json();
}

// 返回 'cancelled' 表示用户停止等待（任务仍在云端执行，pendingTask 保留可恢复）
async function pollUntilDone(tid: string, isCancelled?: () => boolean): Promise<string | null | 'cancelled'> {
  let failures = 0;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 2000));
    if (isCancelled?.()) return 'cancelled';
    try {
      const r = await fetch('/shopgenie/api/studio/poll/' + tid, {
        headers: {
          'X-User-Id': getUserIdHeader()
        }
      });
      if (!r.ok) {
        // 后端明确失败（任务失败/超时/上游错误）时立即停止，网络抖动容忍 3 次
        if (r.status === 408 || r.status === 502 || ++failures >= 3) return null;
        continue;
      }
      failures = 0;
      const d = await r.json() as { task_status: string; results?: Array<{ url: string }> };
      if (d.task_status === 'SUCCEEDED' && d.results?.[0]?.url) return d.results[0].url;
      if (d.task_status === 'FAILED') return null;
    } catch { if (++failures >= 3) return null; }
  }
  return null;
}

type Phase = 'define' | 'scene';
type TaskKind = 'gen' | 'adjust' | 'scene';

// 进行中的付费生图任务：持久化在会话里，刷新/取消后可继续等待，不浪费已提交的调用
interface PendingTask { tid: string; kind: TaskKind; adj?: string }

interface StudioState {
  phase: Phase;
  ref: string | null;
  adjHistory: string[];
  results: Array<{ url: string; tweaking: boolean }>;
  tmplCat: string;
  prompt: string;
  desc: string;
  pendingTask?: PendingTask | null;
}

const DEFAULT_STUDIO: StudioState = {
  phase: 'define', ref: null, adjHistory: [], results: [],
  tmplCat: 'lifestyle', prompt: '', desc: '', pendingTask: null,
};

const TASK_LABEL: Record<TaskKind, { running: string; done: string; failed: string }> = {
  gen: { running: '生成中...', done: '三视图已生成', failed: '生成失败' },
  adjust: { running: '调整中...', done: '已调整', failed: '调整失败' },
  scene: { running: '生成场景...', done: '场景已生成', failed: '场景生成失败' },
};

export default function StudioView({ chat }: {
  chat: {
    createConversation: (p: Platform, t?: string) => Conversation;
    activeConversation: Conversation | null;
    setActiveId: (id: string) => void;
    setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
    appendMessage: (convId: string, msg: Message) => void;
  };
}) {
  const idC = useRef(1);
  const [img, setImg] = useState<string | null>(null);
  const [adj, setAdj] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [tmpl, setTmpl] = useState<DesignTemplates | null>(null);
  const [sel, setSel] = useState<ImageTemplate | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  // 只认 studio 会话，避免把状态写进聊天会话
  const conv = chat.activeConversation?.platform === 'studio' ? chat.activeConversation : null;
  // 没有会话时用本地草稿，首次进入也能正常输入；存 sessionStorage 防刷新丢失（不含图片，避免爆配额）
  const [localStudio, setLocalStudio] = useState<StudioState>(DEFAULT_STUDIO);
  useEffect(() => {
    // 异步恢复草稿，规避 set-state-in-effect 的级联渲染
    Promise.resolve().then(() => {
      try { const raw = window.sessionStorage.getItem('shopgenie.studio.draft'); if (raw) setLocalStudio({ ...DEFAULT_STUDIO, ...JSON.parse(raw) as Partial<StudioState> }); } catch { /* ignore */ }
    });
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('shopgenie.studio.draft', JSON.stringify(localStudio)); } catch { /* ignore */ }
  }, [localStudio]);
  const studio = conv?.studio ?? localStudio;
  const msgs = conv?.messages ?? [];

  const [tmplFailed, setTmplFailed] = useState(false);
  const loadTemplates = () => {
    setTmplFailed(false);
    getDesignTemplates().then(setTmpl).catch(() => setTmplFailed(true));
  };
  useEffect(() => { getDesignTemplates().then(setTmpl).catch(() => setTmplFailed(true)); }, []);

  const ensureConv = (t: string): { id: string } => {
    if (conv) return conv;
    const c = chat.createConversation('studio' as Platform, t.slice(0, 18));
    chat.setActiveId(c.id);
    // 把本地草稿（描述、模板分类等）带进新会话
    const seed = { ...localStudio };
    chat.setConversations((prev) => prev.map(p => p.id === c.id ? { ...p, studio: seed } : p));
    setLocalStudio(DEFAULT_STUDIO);
    return c;
  };

  const addMsg = (convId: string, role: 'user' | 'ai', text: string, image?: string) => {
    // 独立前缀 + 时间戳：避免与 useChat 的 message-N 冲突，重新挂载也不重复
    chat.appendMessage(convId, { id: `studio-${Date.now()}-${idC.current++}`, role, text, image });
  };

  const updateStudio = (patch: Partial<StudioState>) => {
    if (!conv) { setLocalStudio((s) => ({ ...s, ...patch })); return; }
    chat.setConversations((prev) => prev.map(c =>
      c.id === conv.id ? { ...c, studio: { ...(c.studio ?? DEFAULT_STUDIO), ...patch } } : c
    ));
  };

  // 在 setState 回调内基于最新 studio 状态应用任务结果，三类任务共用，避免闭包过期
  const applyTaskResult = (convId: string, kind: TaskKind, url: string | null, adjText?: string) => {
    chat.setConversations((prev) => prev.map(p => {
      if (p.id !== convId) return p;
      const s = p.studio ?? DEFAULT_STUDIO;
      if (!url) return { ...p, studio: { ...s, pendingTask: null } };
      if (kind === 'gen') return { ...p, studio: { ...s, ref: url, adjHistory: [], phase: 'define' as Phase, pendingTask: null } };
      if (kind === 'adjust') return { ...p, studio: { ...s, ref: url, adjHistory: adjText ? [...s.adjHistory, adjText] : s.adjHistory, pendingTask: null } };
      return { ...p, studio: { ...s, results: [...s.results, { url, tweaking: false }], pendingTask: null } };
    }));
    if (url) addMsg(convId, 'ai', TASK_LABEL[kind].done, url);
    else toast(TASK_LABEL[kind].failed);
  };

  // 等待任务完成；task_id 已持久化在 pendingTask，取消/刷新都不会浪费已提交的付费调用
  const waitTask = async (convId: string, pt: PendingTask) => {
    setStatus(TASK_LABEL[pt.kind].running);
    const url = await pollUntilDone(pt.tid, () => cancelRef.current);
    if (url === 'cancelled') {
      toast('已停止等待，任务仍在云端执行，可随时继续', 'info');
      setStatus('');
      return;
    }
    applyTaskResult(convId, pt.kind, url, pt.adj);
    if (url && pt.kind === 'adjust') setAdj('');
    setStatus('');
  };

  const runTask = async (convId: string, kind: TaskKind, submit: () => Promise<unknown>, adjText?: string) => {
    cancelRef.current = false;
    setLoading(true); setStatus('提交...');
    try {
      const { task_id } = await submit() as { task_id: string };
      const pt: PendingTask = { tid: task_id, kind, ...(adjText ? { adj: adjText } : {}) };
      chat.setConversations((prev) => prev.map(p =>
        p.id === convId ? { ...p, studio: { ...(p.studio ?? DEFAULT_STUDIO), pendingTask: pt } } : p
      ));
      await waitTask(convId, pt);
    } catch (e) { toast((e as Error).message); setStatus(''); }
    finally { setLoading(false); }
  };

  // 恢复上次未等完的任务（刷新或主动停止等待之后）
  const resumeTask = async () => {
    const pt = conv?.studio?.pendingTask;
    if (!pt || !conv || loading) return;
    cancelRef.current = false;
    setLoading(true);
    try { await waitTask(conv.id, pt); }
    finally { setLoading(false); }
  };

  const cancelWait = () => { cancelRef.current = true; };

  const handleGen = () => {
    if (!studio.desc.trim() && !img) return;
    const c = ensureConv(studio.desc.trim() || '产品图');
    addMsg(c.id, 'user', img ? '上传产品图' : studio.desc.trim());
    void runTask(c.id, 'gen', () => apiPost('/shopgenie/api/studio/generate-product', { base_desc: studio.desc.trim(), image_b64: img || '' }));
  };

  const handleAdjust = () => {
    if (!adj.trim() || !studio.ref) return;
    const full = [...studio.adjHistory, adj.trim()].join('；');
    const c2 = ensureConv(adj.trim());
    addMsg(c2.id, 'user', `调整: ${adj.trim()}`);
    void runTask(c2.id, 'adjust', () => apiPost('/shopgenie/api/studio/adjust-product', { reference_b64: studio.ref, instructions: full }), adj.trim());
  };

  const handleConfirm = () => {
    if (!conv) return;
    chat.setConversations((prev) => prev.map(c =>
      c.id === conv.id ? { ...c, studio: { ...(c.studio ?? DEFAULT_STUDIO), phase: 'scene' } } : c
    ));
  };

  const handleScene = () => {
    if (!studio.ref) return;
    // 模板的 prompt_template 作为基础，自定义描述作为补充
    const base = sel ? (sel.prompt_template || sel.description || sel.name) : '';
    const p = [base, studio.prompt.trim()].filter(Boolean).join('，');
    if (!p) return;
    const c3 = ensureConv(p);
    addMsg(c3.id, 'user', `场景: ${p}`);
    void runTask(c3.id, 'scene', () => apiPost('/shopgenie/api/studio/generate-scene', { product_ref_b64: studio.ref, prompt: p }));
  };

  const handleTweak = async (idx: number) => {
    const item = studio.results[idx];
    if (!item || !conv) return;
    const convId = conv.id;
    const inst = studio.prompt.trim() || '提升画质，增强细节';
    // 在 setState 回调内按 URL 匹配最新 results，避免覆盖微调期间新增的场景图
    const patchResult = (matchUrl: string, patch: (x: { url: string; tweaking: boolean }) => { url: string; tweaking: boolean }) => {
      chat.setConversations((prev) => prev.map(c =>
        c.id === convId
          ? { ...c, studio: { ...(c.studio ?? DEFAULT_STUDIO), results: (c.studio?.results ?? []).map(x => (x.url === matchUrl ? patch(x) : x)) } }
          : c
      ));
    };
    patchResult(item.url, (x) => ({ ...x, tweaking: true }));
    try {
      const { task_id } = await apiPost('/shopgenie/api/studio/tweak-scene', { product_ref_b64: item.url, prompt: inst }) as { task_id: string };
      const url = await pollUntilDone(task_id);
      patchResult(item.url, (x) => ({ url: url ?? x.url, tweaking: false }));
    } catch (e) {
      toast((e as Error).message);
      patchResult(item.url, (x) => ({ ...x, tweaking: false }));
    }
  };

  const cats = tmpl?.categories ?? {};
  const filtered = tmpl?.templates.filter(t => cats[studio.tmplCat]?.template_ids.includes(t.id)) ?? [];

  const pendingTask = conv?.studio?.pendingTask;

  return (<div className="studio-view dot-grid">
    <div className="studio-left"><div className="studio-section">
      {pendingTask && !loading && (
        <div className="studio-resume-banner">
          <span>有一个未完成的生成任务（{TASK_LABEL[pendingTask.kind].running.replace('...', '')}）</span>
          <button onClick={resumeTask}>继续等待</button>
          <button onClick={() => updateStudio({ pendingTask: null })}>放弃</button>
        </div>
      )}
      <div className="workspace-section-title">{studio.phase === 'define' ? '步骤 1：产品定义' : '产品参考图'}</div>
      {studio.phase === 'define' ? (<>
        <textarea className="studio-prompt" placeholder="描述产品（有图可跳过）…" value={studio.desc} onChange={e => updateStudio({ desc: e.target.value })} rows={3} maxLength={300} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => { const data = r.result as string; if (data.length > 5_000_000) { toast('图片编码后超过限制，请压缩到约 3.5MB 以内'); return; } setImg(data); }; r.readAsDataURL(f); } e.target.value = ''; }} />
          <button className="studio-upload-btn" onClick={() => fileRef.current?.click()}>{img ? '✓ 已上传' : '📷 上传产品图'}</button>
          {img && <button className="studio-upload-btn" onClick={() => setImg(null)} style={{ background: 'transparent', border: '1px solid var(--line)' }}>清除</button>}
          {img && <img src={img} alt="" style={{ height: 40, borderRadius: 6 }} />}
        </div>
        <button className="studio-generate-btn" onClick={handleGen} disabled={(!studio.desc.trim() && !img) || loading}>{loading ? (status || '生成中…') : '生成三视参考图'}</button>
      </>) : null}
      {studio.ref && (<div className="studio-ref-preview">
        <img src={studio.ref} alt="三视图" />
        {studio.phase === 'define' && (<div className="studio-adjust-row">
          <textarea className="studio-prompt" placeholder={studio.adjHistory.length ? `调整${studio.adjHistory.length+1}：…` : '调整：颜色深、加logo…'} value={adj} onChange={e => setAdj(e.target.value)} rows={2} maxLength={200} />
          <button className="studio-generate-btn" onClick={handleAdjust} disabled={!adj.trim() || loading}>调整</button>
          <button className="studio-confirm-btn" onClick={handleConfirm} disabled={loading}>确认，进入场景 →</button>
          {studio.adjHistory.length > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>已应用：{studio.adjHistory.join(' → ')}</div>}
        </div>)}
      </div>)}
      {msgs.length > 0 && (<div className="studio-section" style={{ marginTop: 16 }}><div className="workspace-section-title">对话记录</div><div className="studio-chat-log">{msgs.map(m => (<div key={m.id} className={`studio-msg ${m.role}`}><span className="studio-msg-role">{m.role === 'user' ? '你' : 'AI'}</span><span className="studio-msg-text">{m.text}</span>{m.image && <img src={m.image} alt="" className="studio-msg-img" />}</div>))}</div></div>)}
    </div></div>
    <div className="studio-right">
      {studio.phase === 'scene' ? (<>
        <div className="studio-section"><div className="workspace-section-title">步骤 2：选择场景</div>
          {tmplFailed && (<div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>场景模板加载失败 <button onClick={loadTemplates} style={{ border: '1px solid var(--line)', borderRadius: 6, padding: '2px 10px', cursor: 'pointer', background: 'var(--surface)', fontSize: 12 }}>重试</button></div>)}
          <div className="studio-categories">{Object.entries(cats).map(([k, v]) => (<button key={k} className={`studio-cat${studio.tmplCat === k ? ' active' : ''}`} onClick={() => { updateStudio({ tmplCat: k }); setSel(null); }}><span className="studio-cat-icon">{v.name.slice(0,1)}</span>{v.name}</button>))}</div>
          <div className="studio-template-grid">{filtered.map(t => (
            <button key={t.id} className={`studio-tpl-card${sel?.id === t.id ? ' selected' : ''}`} onClick={() => { setSel(t); updateStudio({ prompt: '' }); }}>
              <div className="studio-tpl-ratio">{t.aspect_ratio.split(':').join('×')}</div>
              <strong>{t.name}</strong>
              <span>{t.description}</span>
              {t.tags.length > 0 && <div className="studio-tpl-tags">{t.tags.slice(0, 2).map(tag => <small key={tag}>{tag}</small>)}</div>}
            </button>
          ))}</div>
        </div>
        <div className="studio-section"><div className="workspace-section-title">自定义场景描述</div>
          <textarea className="studio-prompt" placeholder={sel ? `「${sel.name}」已选，可补充细节…` : '描述你想要的场景：背景、光线、角度…'} value={studio.prompt} onChange={e => updateStudio({ prompt: e.target.value })} rows={3} maxLength={500} />
          <div className="studio-prompt-hint">{sel ? `已选模板: ${sel.name} · ${sel.aspect_ratio}` : '未选模板，将使用自定义描述'}</div>
          <button className="studio-generate-btn" onClick={handleScene} disabled={loading || (!studio.prompt.trim() && !sel)}>{loading ? (status || '生成中…') : '生成场景图'}</button>
          <button className="studio-back-btn" onClick={() => updateStudio({ phase: 'define', prompt: '' })}>← 返回调整产品</button>
        </div>
        {studio.results.length > 0 && (<div className="studio-section"><div className="workspace-section-title">生成结果 ({studio.results.length})<button onClick={() => updateStudio({ results: [] })} style={{ border: '1px solid var(--line)', borderRadius: 6, fontSize: 10, padding: '2px 8px', cursor: 'pointer', background: 'var(--surface)', marginLeft: 8 }}>清除</button></div>
          <div className="studio-results">{studio.results.map((r, i) => (<div key={i} className="studio-result-card" style={{ position: 'relative' }}>
            <img src={r.url} alt={`结果 ${i + 1}`} />
            <button onClick={() => handleTweak(i)} disabled={r.tweaking} style={{ position: 'absolute', bottom: 6, right: 6, padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(0,0,0,.15)', background: 'rgba(255,255,255,.85)', fontSize: 10, cursor: 'pointer' }}>{r.tweaking ? '微调中…' : '微调'}</button>
          </div>))}</div></div>)}
      </>) : (<div className="studio-section"><div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>{studio.ref ? '确认产品外观后，点击「确认，进入场景」' : '先描述产品或上传图片，生成三视图'}</div></div>)}
    </div>
    {loading && (
      <div className="studio-task-bar">
        <span className="studio-task-spinner" />
        <span>{status || '生成中…'}</span>
        <button onClick={cancelWait}>停止等待</button>
      </div>
    )}
  </div>);
}

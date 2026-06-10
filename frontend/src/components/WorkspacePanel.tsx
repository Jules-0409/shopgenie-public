'use client';

import { useEffect, useState } from 'react';
import {
  addContentVersion,
  analyzeReviews,
  clearReviews,
  createKnowledge,
  createCustomTemplate,
  createPerformance,
  createProduct,
  deleteCustomTemplate,
  discoverKnowledge,
  getDesignTemplates,
  getPerformanceInsights,
  importKnowledge,
  listContentAssets,
  listContentVersions,
  listKnowledge,
  listPerformance,
  listProducts,
  listTasks,
  reviseContent,
  runAgentTask,
  type AgentTask,
  type ContentAsset,
  type ContentVersion,
  type ImageTemplate,
  type DesignTemplates,
  type KnowledgeSource,
  type PerformanceRecord,
  type PerformanceInsights,
  type Product,
} from '@/lib/api';
import { toast } from '@/lib/toast';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';
import { useEscClose } from '@/hooks/useEscClose';
import VersionDiff from './VersionDiff';

type Tab = 'products' | 'content' | 'knowledge' | 'tasks' | 'performance' | 'scene';
const split = (value: string) => value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);

interface WorkspacePanelProps {
  open: boolean;
  onClose: () => void;
  activeProductId: string | null;
  onActiveProductChange: (productId: string | null) => void;
  targetAssetId: string | null;
}

export default function WorkspacePanel({ open, onClose, activeProductId, onActiveProductChange, targetAssetId }: WorkspacePanelProps) {
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [metrics, setMetrics] = useState<PerformanceRecord[]>([]);
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEscClose(open, onClose);

  const refresh = async () => {
    try {
      const [nextProducts, nextAssets, nextSources, nextTasks, nextMetrics, nextInsights] = await Promise.all([
        listProducts(), listContentAssets(), listKnowledge(), listTasks(), listPerformance(), getPerformanceInsights(),
      ]);
      setProducts(nextProducts);
      setAssets(nextAssets);
      setSources(nextSources);
      setTasks(nextTasks);
      setMetrics(nextMetrics);
      setInsights(nextInsights);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '工作台加载失败');
    }
  };

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      void refresh();
      if (targetAssetId) {
        setTab('content');
        setSelectedAssetId(targetAssetId);
      }
    });
  }, [open, targetAssetId]);

  useEffect(() => {
    if (!selectedAssetId) return;
    listContentVersions(selectedAssetId).then(setVersions).catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : '版本加载失败'));
  }, [selectedAssetId]);

  if (!open) return null;

  return (
    <div className="workspace-overlay" onClick={onClose}>
      <section className="workspace-panel" onClick={(event) => event.stopPropagation()}>
        <header className="workspace-header">
          <div><span>Content OS</span><h2>内容工作台</h2><p>商品事实、内容版本、规则知识和发布效果都在这里。</p></div>
          <button onClick={onClose}>关闭</button>
        </header>
        <nav className="workspace-tabs">
          {([
            ['products', '商品库'], ['content', '内容资产'], ['knowledge', '知识来源'], ['tasks', 'Agent 任务'], ['performance', '效果数据'], ['scene', '📸 场景'],
          ] as [Tab, string][]).map(([value, label]) => <button className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{label}</button>)}
        </nav>
        {error && <div className="workspace-error">{error}</div>}
        <div className="workspace-body">
          {tab === 'products' && <ProductsTab products={products} activeProductId={activeProductId} onSelect={onActiveProductChange} onCreated={refresh} />}
          {tab === 'content' && <ContentTab key={versions[0]?.id ?? 'empty'} assets={assets} products={products} selectedAssetId={selectedAssetId} versions={versions} onSelect={setSelectedAssetId} onSaved={async () => { await refresh(); if (selectedAssetId) setVersions(await listContentVersions(selectedAssetId)); }} />}
          {tab === 'knowledge' && <KnowledgeTab sources={sources} onCreated={refresh} />}
          {tab === 'tasks' && <TasksTab tasks={tasks} assets={assets} onCompleted={refresh} />}
          {tab === 'performance' && <PerformanceTab assets={assets} metrics={metrics} insights={insights} onCreated={refresh} />}
          {tab === 'scene' && <SceneTab />}
        </div>
      </section>
    </div>
  );
}

function ProductsTab({ products, activeProductId, onSelect, onCreated }: {
  products: Product[]; activeProductId: string | null; onSelect: (id: string | null) => void; onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [facts, setFacts] = useState('');
  const [prohibited, setProhibited] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    const product = await createProduct({
      name: name.trim(), category: category.trim(), audience: '', selling_points: split(sellingPoints),
      facts: split(facts), prohibited_claims: split(prohibited), notes: '',
    });
    setName(''); setCategory(''); setSellingPoints(''); setFacts(''); setProhibited('');
    onSelect(product.id);
    await onCreated();
  };

  return (
    <div className="workspace-grid">
      <div className="workspace-list">
        <div className="workspace-section-title">当前生成使用的商品</div>
        <button className={!activeProductId ? 'workspace-list-item selected' : 'workspace-list-item'} onClick={() => onSelect(null)}><strong>不指定商品</strong><span>仅使用当前对话信息</span></button>
        {products.map((product) => <button className={`workspace-list-item ${activeProductId === product.id ? 'selected' : ''}`} key={product.id} onClick={() => onSelect(product.id)}><strong>{product.name}</strong><span>{product.category || '未填写品类'} · {product.facts.length} 条事实</span></button>)}
      </div>
      <div className="workspace-editor">
        <div className="workspace-section-title">新建商品事实卡</div>
        <label>商品名<input value={name} onChange={(event) => setName(event.target.value)} placeholder="轻量保温杯" /></label>
        <label>品类<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="家居用品" /></label>
        <label>核心卖点<textarea value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} placeholder="轻量、单手开盖" /></label>
        <label>已确认事实<textarea value={facts} onChange={(event) => setFacts(event.target.value)} placeholder="容量 500ml、杯身 230g" /></label>
        <label>禁止声明<textarea value={prohibited} onChange={(event) => setProhibited(event.target.value)} placeholder="永不漏水、保温 48 小时" /></label>
        <button className="workspace-primary" disabled={!name.trim()} onClick={create}>保存并用于生成</button>
        <ReviewMiningPanel product={products.find((item) => item.id === activeProductId) ?? null} onChanged={onCreated} />
      </div>
    </div>
  );
}

function ReviewMiningPanel({ product, onChanged }: { product: Product | null; onChanged: () => Promise<void> }) {
  const [reviews, setReviews] = useState('');
  const [busy, setBusy] = useState(false);
  const insights = product?.review_insights ?? null;

  if (!product) {
    return (
      <div className="review-mining">
        <div className="workspace-section-title">💬 评论反哺</div>
        <p className="review-hint">选中左侧一个商品后，可粘贴买家真实评价，AI 会提炼用户真实在乎的卖点与顾虑，自动反哺到该商品的内容生成。</p>
      </div>
    );
  }

  const analyze = async () => {
    if (!reviews.trim() || busy) return;
    setBusy(true);
    try {
      await analyzeReviews(product.id, reviews.trim());
      setReviews('');
      toast('评论分析完成，洞察已注入该商品生成上下文', 'success');
      await onChanged();
    } catch (error) {
      toast(error instanceof Error ? error.message : '评论分析失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await clearReviews(product.id);
      toast('已清除评论洞察', 'info');
      await onChanged();
    } catch (error) {
      toast(error instanceof Error ? error.message : '清除失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="review-mining">
      <div className="workspace-section-title">💬 评论反哺 · {product.name}</div>
      <label>买家评价（每行一条，粘贴即可）
        <textarea value={reviews} onChange={(event) => setReviews(event.target.value)} placeholder={'回购第三次了，敷完第二天上妆不卡粉\n瓶口有点容易洒\n学生党也买得起'} rows={5} />
      </label>
      <button className="workspace-primary" disabled={!reviews.trim() || busy} onClick={analyze}>{busy ? '分析中…' : '分析并反哺生成'}</button>
      {insights && (
        <div className="review-insights">
          <div className="review-insights-head">
            <span>基于 {insights.review_count} 条评价</span>
            <button className="review-clear" disabled={busy} onClick={clear}>清除</button>
          </div>
          {insights.summary && <p className="review-summary">{insights.summary}</p>}
          {insights.loved_points.length > 0 && <ReviewChips title="用户最认可" tone="loved" items={insights.loved_points} />}
          {insights.pain_points.length > 0 && <ReviewChips title="高频顾虑" tone="pain" items={insights.pain_points} />}
          {insights.voice_quotes.length > 0 && <ReviewChips title="可借用原声" tone="quote" items={insights.voice_quotes} />}
          {insights.avoid_phrases.length > 0 && <ReviewChips title="易踩雷表达" tone="avoid" items={insights.avoid_phrases} />}
        </div>
      )}
    </div>
  );
}

function ReviewChips({ title, tone, items }: { title: string; tone: string; items: string[] }) {
  return (
    <div className="review-chip-group">
      <span className="review-chip-title">{title}</span>
      <div className="review-chip-row">{items.map((item, i) => <span className={`review-chip review-chip-${tone}`} key={i}>{item}</span>)}</div>
    </div>
  );
}

function ContentTab({ assets, products, selectedAssetId, versions, onSelect, onSaved }: {
  assets: ContentAsset[]; products: Product[]; selectedAssetId: string | null; versions: ContentVersion[]; onSelect: (id: string) => void; onSaved: () => Promise<void>;
}) {
  const latest = versions[0];
  const [title, setTitle] = useState(latest?.content.title ?? '');
  const [body, setBody] = useState(latest?.content.body ?? '');
  const [changeNote, setChangeNote] = useState('手动优化');
  const [instruction, setInstruction] = useState('');
  const [revising, setRevising] = useState(false);

  const save = async () => {
    if (!selectedAssetId || !latest) return;
    await addContentVersion(selectedAssetId, { ...latest.content, title, body }, changeNote);
    await onSaved();
  };

  const revise = async () => {
    if (!selectedAssetId || !instruction.trim() || revising) return;
    setRevising(true);
    try {
      await reviseContent(selectedAssetId, instruction.trim());
      setInstruction('');
      await onSaved();
    } finally {
      setRevising(false);
    }
  };

  const autoRevise = async () => {
    if (!selectedAssetId || !latest || latest.quality.suggestions.length === 0 || revising) return;
    setRevising(true);
    try {
      await reviseContent(selectedAssetId, `请修复以下质量问题，并保持原有商品事实不变：${latest.quality.suggestions.join('；')}`);
      await onSaved();
    } finally {
      setRevising(false);
    }
  };

  return (
    <div className="workspace-grid">
      <div className="workspace-list">{assets.length === 0 && <div className="workspace-empty">生成一条内容后，会自动保存到这里。</div>}{assets.map((asset) => <button className={`workspace-list-item ${selectedAssetId === asset.id ? 'selected' : ''}`} key={asset.id} onClick={() => onSelect(asset.id)}><strong>{asset.name}</strong><span>{PLATFORM_LABELS[asset.platform]} · v{asset.current_version} · {products.find((item) => item.id === asset.product_id)?.name ?? '未关联商品'}</span></button>)}</div>
      <div className="workspace-editor">
        {!latest ? <div className="workspace-empty">选择一条内容，查看质量报告并创建新版本。</div> : <>
          <div className="quality-score"><strong>{latest.quality.score}</strong><span>质量分</span></div>
          <div className="quality-checks">{latest.quality.checks.map((check) => <span className={check.passed ? 'passed' : 'failed'} key={check.name}>{check.passed ? '✓' : '!'} {check.name}</span>)}</div>
          {latest.quality.suggestions.length > 0 && <div className="quality-suggestions">{latest.quality.suggestions.map((suggestion) => <span key={suggestion}>{suggestion}</span>)}<button disabled={revising} onClick={autoRevise}>按质量建议自动修订</button></div>}
          <div className="ai-revise-box">
            <strong>让 Agent 局部改写</strong>
            <div><input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：保留标题，只把正文写得更像真实用户分享" /><button disabled={!instruction.trim() || revising} onClick={revise}>{revising ? '修改中…' : '创建新版本'}</button></div>
          </div>
          <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>正文<textarea className="content-editor-body" value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <label>本次修改说明<input value={changeNote} onChange={(event) => setChangeNote(event.target.value)} /></label>
          <button className="workspace-primary" onClick={save}>保存为 v{latest.version + 1}</button>
          <div className="version-list">{versions.map((version, index) => (
            <div key={version.id}>
              <strong>v{version.version}</strong>
              <span>{version.change_note} · 质量 {version.quality.score}</span>
              {index < versions.length - 1 && (
                <VersionDiff
                  oldContent={versions[index + 1].content}
                  newContent={version.content}
                  oldVersion={versions[index + 1].version}
                  newVersion={version.version}
                />
              )}
            </div>
          ))}</div>
        </>}
      </div>
    </div>
  );
}

function KnowledgeTab({ sources, onCreated }: { sources: KnowledgeSource[]; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState(''); const [platform, setPlatform] = useState<Platform>('xhs'); const [content, setContent] = useState(''); const [url, setUrl] = useState(''); const [query, setQuery] = useState(''); const [importing, setImporting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sources.find((s) => s.id === selectedId) ?? null;
  const create = async () => {
    if (!title.trim() || !content.trim()) return;
    await createKnowledge({ title, platform, content, source_type: 'platform_rule', url: '' });
    setTitle(''); setContent(''); await onCreated();
  };
  const importUrl = async () => { if (!url.trim() || importing) return; setImporting(true); try { await importKnowledge(url.trim(), platform); setUrl(''); await onCreated(); } finally { setImporting(false); } };
  const discover = async () => { if (!query.trim() || importing) return; setImporting(true); try { await discoverKnowledge(query.trim(), platform); setQuery(''); await onCreated(); } finally { setImporting(false); } };
  return <div className="workspace-grid"><div className="workspace-list">{sources.map((source) => <button className={`workspace-list-item${selectedId === source.id ? ' selected' : ''}`} key={source.id} onClick={() => setSelectedId(source.id)}><strong>{source.title}</strong><span>{source.platform ? PLATFORM_LABELS[source.platform] : '通用'} · {source.content.slice(0, 60)}</span></button>)}</div><div className="workspace-editor">{selected ? (<>
    <div className="workspace-section-title">{selected.title}</div>
    <div className="knowledge-meta"><span className="knowledge-tag">{selected.platform ? PLATFORM_LABELS[selected.platform] : '通用'}</span><span className="knowledge-type">{selected.source_type}</span>{selected.url && <a href={selected.url} rel="noreferrer" target="_blank">查看原始来源 →</a>}</div>
    <div className="knowledge-content">{selected.content}</div>
    <button className="workspace-secondary" onClick={() => setSelectedId(null)}>返回列表</button>
  </>) : (<>
    <div className="workspace-section-title">发现最新规则、趋势或竞品资料</div>
    <label>检索主题<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：2026 小红书家居好物内容趋势" /></label>
    <label>平台<select value={platform} onChange={(event) => setPlatform(event.target.value as Platform)}>{Object.entries(PLATFORM_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <button className="workspace-primary" disabled={!query.trim() || importing} onClick={discover}>{importing ? '检索中…' : '发现并保存来源'}</button>
    <div className="workspace-divider">导入指定网页</div>
    <label>网页 URL<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." /></label>
    <button className="workspace-primary" disabled={!url.trim() || importing} onClick={importUrl}>{importing ? '抓取中…' : '抓取并保存来源'}</button>
    <div className="workspace-divider">或手动添加</div>
    <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label>内容<textarea className="content-editor-body" value={content} onChange={(event) => setContent(event.target.value)} placeholder="粘贴平台规则、商品说明或经过验证的运营知识" /></label>
    <button className="workspace-primary" onClick={create}>加入知识库</button>
  </>)}</div></div>;
}

function TasksTab({ tasks, assets, onCompleted }: { tasks: AgentTask[]; assets: ContentAsset[]; onCompleted: () => Promise<void> }) {
  const [assetId, setAssetId] = useState(''); const [objective, setObjective] = useState(''); const [running, setRunning] = useState(false);
  const run = async () => { if (!assetId || !objective.trim() || running) return; setRunning(true); try { await runAgentTask(objective.trim(), assetId); setObjective(''); await onCompleted(); } finally { setRunning(false); } };
  return <><div className="agent-runner"><div><span>Run an agent task</span><strong>让 Agent 读取事实、修改内容并重新质检</strong></div><select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">选择内容资产</option>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.name}</option>)}</select><input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="例如：把这篇内容优化得更像真实买家分享，并修复所有质量问题" /><button disabled={!assetId || !objective.trim() || running} onClick={run}>{running ? '执行中…' : '执行任务'}</button></div><div className="task-grid">{tasks.length === 0 && <div className="workspace-empty">发起一次生成或执行任务后，这里会保留计划和结果。</div>}{tasks.map((task) => <article className="task-card" key={task.id}><span>{task.status === 'failed' ? 'Agent failed' : 'Agent plan'}</span><h3>{task.objective}</h3>{task.steps.map((step) => <div className={step.status} key={step.name}>{step.status === 'completed' ? '✓' : step.status === 'failed' ? '!' : '○'} {step.name}</div>)}{task.result_summary && <p>{task.result_summary}</p>}</article>)}</div></>;
}

function PerformanceTab({ assets, metrics, insights, onCreated }: { assets: ContentAsset[]; metrics: PerformanceRecord[]; insights: PerformanceInsights | null; onCreated: () => Promise<void> }) {
  const [assetId, setAssetId] = useState(''); const [impressions, setImpressions] = useState(''); const [conversions, setConversions] = useState('');
  const create = async () => {
    const asset = assets.find((item) => item.id === assetId); if (!asset) return;
    await createPerformance({ asset_id: assetId, platform: asset.platform, impressions: Number(impressions) || 0, conversions: Number(conversions) || 0, engagements: 0, clicks: 0, revenue: 0, notes: '' });
    setImpressions(''); setConversions(''); await onCreated();
  };
  return <div className="workspace-grid"><div className="workspace-list">{insights && <div className="performance-summary"><strong>{insights.conversion_rate}%</strong><span>整体转化率</span><p>{insights.summary}</p></div>}{metrics.map((metric) => <div className="workspace-list-item static" key={metric.id}><strong>{assets.find((item) => item.id === metric.asset_id)?.name ?? '内容资产'}</strong><span>曝光 {metric.impressions} · 转化 {metric.conversions}</span></div>)}</div><div className="workspace-editor"><div className="workspace-section-title">记录发布效果</div><label>内容<select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">选择内容资产</option>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.name}</option>)}</select></label><label>曝光量<input type="number" min="0" value={impressions} onChange={(event) => setImpressions(event.target.value)} /></label><label>转化数<input type="number" min="0" value={conversions} onChange={(event) => setConversions(event.target.value)} /></label><button className="workspace-primary" disabled={!assetId} onClick={create}>记录效果</button></div></div>;
}

function SceneTab() {
  const [tmpl, setTmpl] = useState<DesignTemplates | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // New template form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [tags, setTags] = useState('');
  const [category, setCategory] = useState('lifestyle');
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const refresh = async () => {
    try { const d = await getDesignTemplates(); setTmpl(d); } catch { /* ignore */ }
  };
  useEffect(() => { getDesignTemplates().then(setTmpl).catch(() => { /* ignore */ }); }, []);

  const all = tmpl?.templates ?? [];
  const selected = all.find(t => t.id === selectedId) ?? null;

  const handleCreate = async () => {
    if (!name.trim() || !promptTemplate.trim() || saving) return;
    setSaving(true);
    try {
      await createCustomTemplate({
        name: name.trim(), description: description.trim(), prompt_template: promptTemplate.trim(),
        aspect_ratio: aspectRatio, tags: split(tags), category,
      });
      setName(''); setDescription(''); setPromptTemplate(''); setTags(''); setAspectRatio('1:1'); setCategory('lifestyle');
      setShowNew(false);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : '创建失败'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!selected || selected.builtin) return;
    try {
      await deleteCustomTemplate(selected.id);
      setSelectedId(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : '删除失败'); }
  };

  return <div className="workspace-grid">
    <div className="workspace-list">
      <div className="workspace-section-title">场景模板库<button onClick={() => { setShowNew(true); setSelectedId(null); }} style={{ border: '1px solid var(--line)', borderRadius: 6, fontSize: 10, padding: '2px 8px', cursor: 'pointer', background: 'var(--surface)', marginLeft: 8 }}>+ 新建</button></div>
      {all.length === 0 && <div className="workspace-empty">模板加载中…</div>}
      {all.map(t => (
        <button className={`workspace-list-item${selectedId === t.id ? ' selected' : ''}`} key={t.id} onClick={() => { setSelectedId(t.id); setShowNew(false); }}>
          <strong>{t.builtin ? '📦 ' : '✏️ '}{t.name}</strong>
          <span>{t.aspect_ratio} · {t.description.slice(0, 40)}{t.description.length > 40 ? '…' : ''}</span>
        </button>
      ))}
    </div>
    <div className="workspace-editor">
      {error && <div className="workspace-error">{error}<button onClick={() => setError('')} style={{ marginLeft: 8, border: 'none', background: 'none', cursor: 'pointer' }}>✕</button></div>}

      {showNew ? (<>
        <div className="workspace-section-title">新建场景模板</div>
        <label>模板名称<input value={name} onChange={e => setName(e.target.value)} placeholder="例如：秋季暖光场景" maxLength={50} /></label>
        <label>描述<input value={description} onChange={e => setDescription(e.target.value)} placeholder="适用场景说明" maxLength={200} /></label>
        <label>Prompt 模板<textarea className="content-editor-body" value={promptTemplate} onChange={e => setPromptTemplate(e.target.value)} placeholder="英文 prompt，可用 {product} 占位产品名" rows={5} maxLength={1000} /></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>比例<select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>{['1:1','4:5','16:9','9:16'].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
          <label style={{ flex: 1 }}>分类<select value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(tmpl?.categories ?? {}).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></label>
        </div>
        <label>标签（逗号分隔）<input value={tags} onChange={e => setTags(e.target.value)} placeholder="简约, 自然光" /></label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="workspace-primary" onClick={handleCreate} disabled={!name.trim() || !promptTemplate.trim() || saving}>{saving ? '创建中…' : '保存模板'}</button>
          <button className="workspace-secondary" onClick={() => setShowNew(false)}>取消</button>
        </div>
      </>) : selected ? (<>
        <div className="workspace-section-title">{selected.name}<span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>{selected.builtin ? '内置' : '自定义'}</span></div>
        <div className="knowledge-meta">
          <span className="knowledge-tag">{selected.aspect_ratio}</span>
          {selected.tags.map(t => <span className="knowledge-type" key={t}>{t}</span>)}
        </div>
        <div className="workspace-section-title" style={{ marginTop: 12 }}>描述</div>
        <div className="knowledge-content">{selected.description || '无描述'}</div>
        <div className="workspace-section-title" style={{ marginTop: 12 }}>Prompt 模板</div>
        <div className="knowledge-content" style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{selected.prompt_template || '(无)'}</div>
        {!selected.builtin && <button className="workspace-secondary" onClick={handleDelete} style={{ marginTop: 12, color: '#c44' }}>删除此模板</button>}
        <button className="workspace-secondary" onClick={() => setSelectedId(null)} style={{ marginTop: 8 }}>返回列表</button>
      </>) : <div className="workspace-empty">选择一个模板查看其 Prompt，或点击「+ 新建」创建自定义场景模板。</div>}
    </div>
  </div>;
}

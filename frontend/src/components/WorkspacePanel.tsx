'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { swrKeys, swrFetcher } from '@/lib/swr-fetcher';
import {
  addContentVersion,
  analyzeReviews,
  clearReviews,
  deleteExperiment,
  generateExperiment,
  recordVariantMetrics,
  createKnowledge,
  createPerformance,
  createProduct,
  discoverKnowledge,
  importKnowledge,
  listContentAssets,
  listContentVersions,
  listKnowledge,
  listPerformance,
  listTasks,
  reviseContent,
  runAgentTask,
  updateProduct,
  scheduleContentAsset,
  type AgentTask,
  type ContentAsset,
  type ContentVersion,
  type ImageTemplate,
  type DesignTemplates,
  type KnowledgeSource,
  type PerformanceRecord,
  type PerformanceInsights,
  type Product,
  type Experiment,
  type ExperimentVariant,
  type MarketingEvent,
  type MarketingCalendarData,
} from '@/lib/api';
import { toast } from '@/lib/toast';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';
import { useEscClose } from '@/hooks/useEscClose';
import VersionDiff from './VersionDiff';
import PerformanceCsvImport from './PerformanceCsvImport';

export type WorkspaceTab = 'products' | 'content' | 'experiments' | 'knowledge' | 'tasks' | 'performance' | 'calendar';
type Tab = WorkspaceTab;
const split = (value: string) => value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);

interface WorkspacePanelProps {
  open: boolean;
  onClose: () => void;
  activeProductId: string | null;
  productContextLocked: boolean;
  onActiveProductChange: (productId: string | null) => void;
  targetAssetId: string | null;
  initialTab?: WorkspaceTab;
  prefillParams?: {
    product_id?: string | null;
    asset_id?: string | null;
    platform?: Platform | null;
    brief?: string | null;
  } | null;
}

export default function WorkspacePanel({ open, onClose, activeProductId, productContextLocked, onActiveProductChange, targetAssetId, initialTab, prefillParams }: WorkspacePanelProps) {
  const [tab, setTab] = useState<Tab>('products');
  const router = useRouter();
  const searchParams = useSearchParams();

  const setQueryParams = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    Object.entries(params).forEach(([key, val]) => {
      if (val === null) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });
    const query = nextParams.toString();
    const pathname = (typeof window !== 'undefined' ? window.location.pathname : '').replace(/^\/shopgenie/, '') || '/';
    const url = `${pathname}${query ? `?${query}` : ''}`;
    router.replace(url, { scroll: false });
  };

  const { data: products = [], mutate: mutateProducts } = useSWR(swrKeys.products, swrFetcher.products);
  const { data: assets = [], mutate: mutateAssets } = useSWR('/shopgenie/api/assets', listContentAssets);
  const { data: sources = [], mutate: mutateSources } = useSWR('/shopgenie/api/knowledge', listKnowledge);
  const { data: tasks = [], mutate: mutateTasks } = useSWR('/shopgenie/api/tasks', listTasks);
  const { data: metrics = [], mutate: mutateMetrics } = useSWR('/shopgenie/api/performance', listPerformance);
  const { data: insights, mutate: mutateInsights } = useSWR(swrKeys.insights, swrFetcher.insights);
  const { data: experiments = [], mutate: mutateExperiments } = useSWR(swrKeys.experiments, swrFetcher.experiments);
  const { data: calendarData, mutate: mutateCalendar } = useSWR(swrKeys.calendar, swrFetcher.calendar);

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const { data: versions = [], mutate: mutateVersions } = useSWR(
    selectedAssetId ? `/shopgenie/api/assets/${selectedAssetId}/versions` : null,
    () => listContentVersions(selectedAssetId!)
  );

  const [error, setError] = useState('');
  useEscClose(open, onClose);

  const refresh = async () => {
    try {
      await Promise.all([
        mutateProducts(),
        mutateAssets(),
        mutateSources(),
        mutateTasks(),
        mutateMetrics(),
        mutateInsights(),
        mutateExperiments(),
        mutateCalendar(),
      ]);
      if (selectedAssetId) {
        await mutateVersions();
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '工作台数据更新失败');
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
      if (prefillParams?.product_id && prefillParams.product_id !== activeProductId) {
        onActiveProductChange(prefillParams.product_id);
      }
      if (targetAssetId) {
        setTab('content');
        setSelectedAssetId(targetAssetId);
      } else if (initialTab) {
        setTab(initialTab);
      }
    });
  }, [open, targetAssetId, initialTab, prefillParams]);

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
            ['products', '商品库'], ['content', '内容资产'], ['experiments', 'A/B 实验'], ['knowledge', '知识来源'], ['tasks', 'Agent 任务'], ['performance', '效果数据'], ['calendar', '营销日历'],
          ] as [Tab, string][]).map(([value, label]) => <button className={tab === value ? 'active' : ''} key={value} onClick={() => setTab(value)}>{label}</button>)}
        </nav>
        {error && <div className="workspace-error">{error}</div>}
        <div className="workspace-body">
          {tab === 'products' && <ProductsTab products={products} activeProductId={activeProductId} productContextLocked={productContextLocked} onSelect={onActiveProductChange} onCreated={refresh} prefillParams={prefillParams} />}
          {tab === 'content' && <ContentTab key={versions[0]?.id ?? 'empty'} assets={assets} products={products} selectedAssetId={selectedAssetId} versions={versions} onSelect={setSelectedAssetId} onSaved={refresh} />}
          {tab === 'experiments' && <ExperimentsTab experiments={experiments} products={products} activeProductId={activeProductId} onChanged={refresh} prefillParams={prefillParams} />}
          {tab === 'knowledge' && <KnowledgeTab sources={sources} onCreated={refresh} />}
          {tab === 'tasks' && <TasksTab tasks={tasks} assets={assets} onCompleted={refresh} />}
          {tab === 'performance' && <PerformanceTab assets={assets} metrics={metrics} insights={insights ?? null} onCreated={refresh} prefillParams={prefillParams} />}
          {tab === 'calendar' && (
            <CalendarTab
              calendarData={calendarData}
              assets={assets}
              onSaved={refresh}
              onSelectTab={(newTab, assetId) => {
                setTab(newTab);
                if (assetId) setSelectedAssetId(assetId);
              }}
              onClose={onClose}
              activeProductId={activeProductId}
              products={products}
            />
          )}
        </div>
      </section>
    </div>
  );
}

export function ProductsTab({ products, activeProductId, productContextLocked = false, onSelect, onCreated, prefillParams }: {
  products: Product[]; activeProductId: string | null; productContextLocked?: boolean; onSelect: (id: string | null) => void; onCreated: () => Promise<void>;
  prefillParams?: { product_id?: string | null } | null;
}) {
  const [editingId, setEditingId] = useState<string | 'new' | null>(activeProductId);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (prefillParams?.product_id) {
        setEditingId(prefillParams.product_id);
      } else {
        setEditingId(activeProductId);
      }
    });
  }, [prefillParams, activeProductId]);

  const selected = editingId === 'new' ? null : products.find((product) => product.id === editingId) ?? null;

  const selectProduct = (productId: string) => {
    setEditingId(productId);
  };

  const beginCreate = () => {
    setEditingId('new');
  };

  return (
    <div className="workspace-grid">
      <div className="workspace-list">
        <div className="product-list-head"><div className="workspace-section-title">商品库</div><button onClick={beginCreate}>+ 新建商品</button></div>
        <button className={!activeProductId ? 'workspace-list-item active-context' : 'workspace-list-item'} onClick={() => setEditingId(null)}><strong>不指定商品</strong><span>仅使用当前对话信息</span></button>
        {products.map((product) => <button className={`workspace-list-item ${editingId === product.id ? 'selected' : ''} ${activeProductId === product.id ? 'active-context' : ''}`} key={product.id} onClick={() => selectProduct(product.id)}><strong>{product.name}</strong><span>{product.category || '未填写品类'} · {product.facts.length} 条事实{activeProductId === product.id ? ' · 正在用于生成' : ''}</span></button>)}
      </div>
      {editingId === 'new'
        ? <ProductEditor mode="new" onSaved={async (product) => { setEditingId(product.id); await onCreated(); }} />
        : selected
          ? <ProductEditor key={selected.updated_at} mode="edit" product={selected} active={activeProductId === selected.id} contextLocked={productContextLocked} onUse={() => onSelect(selected.id)} onSaved={async () => { await onCreated(); }} />
          : <div className="workspace-editor product-detail-empty"><strong>选择一个商品查看详情</strong><span>右侧会展示商品事实、卖点、禁用声明和评论洞察。查看商品不会改变当前生成上下文。</span>{activeProductId && <button className="workspace-secondary" disabled={productContextLocked} onClick={() => onSelect(null)}>{productContextLocked ? '当前会话已有内容，商品上下文已锁定' : '本次生成不指定商品'}</button>}</div>}
    </div>
  );
}

function ProductEditor({ mode, product, active = false, contextLocked = false, onUse, onSaved }: { mode: 'new' | 'edit'; product?: Product; active?: boolean; contextLocked?: boolean; onUse?: () => void; onSaved: (product: Product) => Promise<void> }) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [audience, setAudience] = useState(product?.audience ?? '');
  const [sellingPoints, setSellingPoints] = useState(product?.selling_points.join('、') ?? '');
  const [facts, setFacts] = useState(product?.facts.join('、') ?? '');
  const [prohibited, setProhibited] = useState(product?.prohibited_claims.join('、') ?? '');
  const [notes, setNotes] = useState(product?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), category: category.trim(), audience: audience.trim(), selling_points: split(sellingPoints),
        facts: split(facts), prohibited_claims: split(prohibited), notes: notes.trim(),
      };
      const saved = mode === 'new' ? await createProduct(payload) : await updateProduct(product!.id, payload);
      toast(mode === 'new' ? '商品已创建，请明确选择是否用于生成' : '商品详情已保存', 'success');
      await onSaved(saved);
    } catch (error) {
      toast(error instanceof Error ? error.message : '商品保存失败');
    } finally {
      setSaving(false);
    }
  };

  return <div className="workspace-editor product-detail">
    <div className="product-detail-head"><div><span>{mode === 'new' ? 'Create product' : 'Product details'}</span><h3>{mode === 'new' ? '新建商品事实卡' : product?.name}</h3></div>{active && <span className="active-product-status">{contextLocked ? '当前会话已锁定' : '正在用于生成'}</span>}</div>
    {mode === 'edit' && !active && <button className="workspace-secondary" disabled={contextLocked} onClick={onUse}>{contextLocked ? '当前会话已有内容，请新建对话后切换商品' : '用于当前生成'}</button>}
    <label>商品名<input value={name} onChange={(event) => setName(event.target.value)} placeholder="轻量保温杯" /></label>
    <label>品类<input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="家居用品" /></label>
    <label>目标人群<input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="城市通勤人群" /></label>
    <label>核心卖点<textarea value={sellingPoints} onChange={(event) => setSellingPoints(event.target.value)} placeholder="轻量、单手开盖" /></label>
    <label>已确认事实<textarea value={facts} onChange={(event) => setFacts(event.target.value)} placeholder="容量 500ml、杯身 230g" /></label>
    <label>禁止声明<textarea value={prohibited} onChange={(event) => setProhibited(event.target.value)} placeholder="永不漏水、保温 48 小时" /></label>
    <label>运营备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="适合秋冬通勤内容" /></label>
    <button className="workspace-primary" disabled={!name.trim() || saving} onClick={save}>{saving ? '保存中…' : mode === 'new' ? '创建商品' : '保存商品详情'}</button>
    {mode === 'edit' && <ReviewMiningPanel product={product ?? null} onChanged={() => onSaved(product!)} />}
  </div>;
}

function ReviewMiningPanel({ product, onChanged }: { product: Product | null; onChanged: () => Promise<void> }) {
  const [reviews, setReviews] = useState('');
  const [busy, setBusy] = useState(false);
  const storedInsights = product?.review_insights ?? null;
  const insights = storedInsights?.product_id === product?.id ? storedInsights : null;

  if (!product) {
    return (
      <div className="review-mining">
        <div className="workspace-section-title">评论反哺</div>
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
      <div className="workspace-section-title">评论反哺 · {product.name}</div>
      {storedInsights && !insights && <p className="review-hint">这份旧评论洞察没有可靠的商品归属，已停止注入生成。请重新分析该商品的真实评价。</p>}
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

const cvr = (v: ExperimentVariant) => v.impressions > 0 ? (v.conversions / v.impressions * 100) : 0;

function ExperimentsTab({ experiments, products, activeProductId, onChanged, prefillParams }: {
  experiments: Experiment[]; products: Product[]; activeProductId: string | null; onChanged: () => Promise<void>;
  prefillParams?: {
    product_id?: string | null;
    asset_id?: string | null;
    platform?: Platform | null;
    brief?: string | null;
  } | null;
}) {
  const [platform, setPlatform] = useState<Platform>('xhs');
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!prefillParams) return;
    Promise.resolve().then(() => {
      if (prefillParams.platform) {
        setPlatform(prefillParams.platform as Platform);
      }
      if (prefillParams.brief) {
        setBrief(prefillParams.brief);
      }
    });
  }, [prefillParams]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await generateExperiment({ product_id: activeProductId, platform, brief: brief.trim() });
      setBrief('');
      toast('已生成变体，去真实投放后回填曝光/转化', 'success');
      await onChanged();
    } catch (error) {
      toast(error instanceof Error ? error.message : '变体生成失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="experiments-tab">
      <div className="workspace-editor exp-generator">
        <div className="workspace-section-title">新建 A/B 实验</div>
        <p className="review-hint">同一商品产出多个标题/钩子变体 → 真实投放 → 回填数据 → 系统判定赢家 → 赢家风格反哺后续生成。{activeProductId ? `当前商品：${products.find((p) => p.id === activeProductId)?.name ?? ''}` : '未选商品，将仅按下方描述生成。'}</p>
        <label>平台
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {(['xhs', 'dy', 'amazon', 'cs'] as Platform[]).map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
          </select>
        </label>
        <label>对比方向 / 补充描述（可选）<textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="例如：主打学生党性价比，想试不同钩子角度" rows={2} /></label>
        <button className="workspace-primary" disabled={busy} onClick={generate}>{busy ? '生成中…' : '生成 3 个变体'}</button>
      </div>

      <div className="exp-list">
        {experiments.length === 0 && <div className="workspace-empty">还没有实验。生成一组变体，开始你的第一次 A/B。</div>}
        {experiments.map((exp) => <ExperimentCard key={exp.id} experiment={exp} products={products} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function ExperimentCard({ experiment, products, onChanged }: { experiment: Experiment; products: Product[]; onChanged: () => Promise<void> }) {
  const productName = products.find((p) => p.id === experiment.product_id)?.name;
  const remove = async () => { await deleteExperiment(experiment.id); toast('已删除实验', 'info'); await onChanged(); };

  return (
    <div className={`exp-card ${experiment.status === 'decided' ? 'decided' : ''}`}>
      <div className="exp-card-head">
        <div>
          <strong>{experiment.name || '未命名实验'}</strong>
          <span className="exp-meta">{PLATFORM_LABELS[experiment.platform]}{productName ? ` · ${productName}` : ''}</span>
        </div>
        <div className="exp-head-right">
          {experiment.status === 'decided'
            ? <span className="exp-status decided">赢家 {experiment.winner_label}</span>
            : <span className="exp-status running">投放中</span>}
          <button className="review-clear" onClick={remove}>删除</button>
        </div>
      </div>
      <div className={`exp-confidence-banner ${experiment.confidence_level}`}>
        <span className="exp-confidence-icon">
          {experiment.confidence_level === 'ready' ? '✅' : '⚠️'}
        </span>
        <span className="exp-confidence-text">{experiment.confidence_message}</span>
      </div>
      <div className="exp-variants">
        {experiment.variants.map((v) => <VariantRow key={v.label} experimentId={experiment.id} variant={v} isWinner={experiment.winner_label === v.label} onChanged={onChanged} />)}
      </div>
    </div>
  );
}

function VariantRow({ experimentId, variant, isWinner, onChanged }: { experimentId: string; variant: ExperimentVariant; isWinner: boolean; onChanged: () => Promise<void> }) {
  const [imp, setImp] = useState(String(variant.impressions || ''));
  const [clk, setClk] = useState(String(variant.clicks || ''));
  const [cnv, setCnv] = useState(String(variant.conversions || ''));
  const [busy, setBusy] = useState(false);
  const rate = cvr(variant);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await recordVariantMetrics(experimentId, { label: variant.label, impressions: Number(imp) || 0, clicks: Number(clk) || 0, conversions: Number(cnv) || 0 });
      toast('已记录，赢家自动更新', 'success');
      await onChanged();
    } catch (error) {
      toast(error instanceof Error ? error.message : '记录失败');
    } finally {
      setBusy(false);
    }
  };

  const percent = Math.min(100, Math.round((variant.impressions / 300) * 100));

  return (
    <div className={`variant-row ${isWinner ? 'winner' : ''}`}>
      <div className="variant-head">
        <span className="variant-label">{variant.label}</span>
        {variant.angle && <span className="variant-angle">{variant.angle}</span>}
        {isWinner && <span className="variant-crown">转化最高</span>}
        {variant.impressions > 0 && <span className="variant-cvr">{rate.toFixed(2)}% 转化</span>}
      </div>
      <div className="variant-title">{variant.title}</div>
      {variant.hook && <div className="variant-hook">开头：{variant.hook}</div>}
      
      {variant.impressions < 300 ? (
        <div className="variant-progress-bar" title={`置信样本进度：${percent}%`}>
          <div className="variant-progress-fill" style={{ width: `${percent}%` }} />
          <span className="variant-progress-text">样本进度 {percent}% (还差 {300 - variant.impressions} 曝光)</span>
        </div>
      ) : (
        <div className="variant-progress-bar ready">
          <div className="variant-progress-fill" style={{ width: '100%' }} />
          <span className="variant-progress-text">✓ 样本已足额 ({variant.impressions} 曝光)</span>
        </div>
      )}

      <div className="variant-metrics">
        <label>曝光<input type="number" min="0" value={imp} onChange={(e) => setImp(e.target.value)} /></label>
        <label>点击<input type="number" min="0" value={clk} onChange={(e) => setClk(e.target.value)} /></label>
        <label>转化<input type="number" min="0" value={cnv} onChange={(e) => setCnv(e.target.value)} /></label>
        <button className="variant-save" disabled={busy} onClick={save}>{busy ? '…' : '记录'}</button>
      </div>
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

  const currentAsset = assets.find((a) => a.id === selectedAssetId);
  const [scheduledAt, setScheduledAt] = useState(currentAsset?.scheduled_at ?? '');
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => setScheduledAt(currentAsset?.scheduled_at ?? ''));
  }, [selectedAssetId, currentAsset]);

  const handleSchedule = async () => {
    if (!selectedAssetId || scheduling) return;
    setScheduling(true);
    try {
      await scheduleContentAsset(selectedAssetId, scheduledAt || null);
      toast('发布排期已更新', 'success');
      await onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : '排期更新失败');
    } finally {
      setScheduling(false);
    }
  };

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

          <div className="content-schedule-box" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '16px' }}>
            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>发布排期</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={scheduledAt || ''} onChange={(e) => setScheduledAt(e.target.value)} style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--text)', fontSize: '13px' }} />
              <button className="workspace-secondary" disabled={scheduling} style={{ whiteSpace: 'nowrap', padding: '4px 12px', fontSize: '12px' }} onClick={handleSchedule}>{scheduling ? '保存中…' : '设定排期'}</button>
            </div>
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

function PerformanceTab({ assets, metrics, insights, onCreated, prefillParams }: {
  assets: ContentAsset[]; metrics: PerformanceRecord[]; insights: PerformanceInsights | null; onCreated: () => Promise<void>;
  prefillParams?: { asset_id?: string | null } | null;
}) {
  const [assetId, setAssetId] = useState('');
  const [impressions, setImpressions] = useState('');
  const [clicks, setClicks] = useState('');
  const [conversions, setConversions] = useState('');
  useEffect(() => {
    if (!prefillParams?.asset_id) return;
    Promise.resolve().then(() => setAssetId(prefillParams.asset_id ?? ''));
  }, [prefillParams]);

  const create = async () => {
    const asset = assets.find((item) => item.id === assetId); if (!asset) return;
    await createPerformance({ asset_id: assetId, platform: asset.platform, impressions: Number(impressions) || 0, conversions: Number(conversions) || 0, engagements: 0, clicks: Number(clicks) || 0, add_to_carts: 0, orders: Number(conversions) || 0, refunds: 0, revenue: 0, ad_spend: 0, notes: '' });
    setImpressions(''); setClicks(''); setConversions(''); await onCreated();
  };

  return (
    <div className="workspace-grid">
      <div className="workspace-list">
        {insights && insights.records > 0 ? (
          <div className="performance-summary">
            <div className="performance-kpis">
              <span><strong>{insights.click_rate}%</strong>CTR</span>
              <span><strong>{insights.click_conversion_rate}%</strong>点击后成交</span>
              <span><strong>{insights.refund_rate}%</strong>退款率</span>
              <span><strong>{insights.roas}</strong>ROAS</span>
            </div>
            <p>{insights.summary}</p>
          </div>
        ) : (
          <div className="workspace-empty">还没有效果数据。右侧录入第一条发布效果（或用 CSV 批量导入），运营指挥台才能开始诊断点击率、转化和退款信号。</div>
        )}
        {metrics.map((metric) => (
          <div className="workspace-list-item static" key={metric.id}>
            <strong>{assets.find((item) => item.id === metric.asset_id)?.name ?? '内容资产'}</strong>
            <span>曝光 {metric.impressions} · 点击 {metric.clicks} · 下单 {metric.orders || metric.conversions} · 退款 {metric.refunds}</span>
          </div>
        ))}
      </div>
      <div className="workspace-editor">
        <div className="workspace-section-title">记录发布效果</div>
        <label>内容
          <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
            <option value="">选择内容资产</option>
            {assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.name}</option>)}
          </select>
        </label>
        <label>曝光量<input type="number" min="0" value={impressions} onChange={(event) => setImpressions(event.target.value)} /></label>
        <label>点击量<input type="number" min="0" value={clicks} onChange={(event) => setClicks(event.target.value)} /></label>
        <label>转化数<input type="number" min="0" value={conversions} onChange={(event) => setConversions(event.target.value)} /></label>
        <button className="workspace-primary" disabled={!assetId} onClick={create}>记录效果</button>
        <PerformanceCsvImport assets={assets} onImported={onCreated} />
      </div>
    </div>
  );
}

function CalendarTab({
  calendarData,
  assets,
  onSaved,
  onSelectTab,
  onClose,
  activeProductId,
  products,
}: {
  calendarData?: MarketingCalendarData;
  assets: ContentAsset[];
  onSaved: () => Promise<void>;
  onSelectTab: (tab: WorkspaceTab, assetId: string | null) => void;
  onClose: () => void;
  activeProductId: string | null;
  products: Product[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setQueryParams = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    Object.entries(params).forEach(([key, val]) => {
      if (val === null) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });
    const query = nextParams.toString();
    const pathname = (typeof window !== 'undefined' ? window.location.pathname : '').replace(/^\/shopgenie/, '') || '/';
    const url = `${pathname}${query ? `?${query}` : ''}`;
    router.replace(url, { scroll: false });
  };

  const events = calendarData?.events ?? [];
  const scheduledAssets = calendarData?.scheduled_assets ?? [];
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (events.length === 0 || selectedEventId) return;
    const firstId = events[0].id;
    Promise.resolve().then(() => setSelectedEventId(firstId));
  }, [events, selectedEventId]);

  const selectedEvent = events.find((e) => e.id === selectedEventId) ?? null;

  const handleCancelSchedule = async (assetId: string) => {
    try {
      await scheduleContentAsset(assetId, null);
      toast('排期已取消', 'info');
      await onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : '取消排期失败');
    }
  };

  return (
    <div className="workspace-grid">
      <div className="workspace-list">
        <div className="workspace-section-title">营销节点排期</div>
        {events.length === 0 ? (
          <div className="workspace-empty">加载营销日历中…</div>
        ) : (
          events.map((event) => (
            <button
              className={`workspace-list-item calendar-node-item ${selectedEventId === event.id ? 'selected' : ''}`}
              key={event.id}
              onClick={() => setSelectedEventId(event.id)}
            >
              <div className="calendar-node-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 4 }}>
                <strong>{event.name}</strong>
                <span className="calendar-node-date" style={{ fontSize: '11px', color: 'var(--muted)' }}>{event.date_range}</span>
              </div>
              <div className="calendar-node-platforms" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {event.platforms.map((p) => (
                  <span className={`platform-badge mini ${p}`} key={p} style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '4px', background: 'rgba(255,255,255,0.08)' }}>
                    {p === 'xhs' ? '小红书' : p === 'dy' ? '抖音' : p === 'amazon' ? 'Amazon' : p}
                  </span>
                ))}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="workspace-editor">
        {selectedEvent ? (
          <>
            <div className="calendar-event-details" style={{ marginBottom: 20 }}>
              <div className="workspace-section-title">{selectedEvent.name} <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--muted)', marginLeft: 8 }}>{selectedEvent.date_range}</span></div>
              <p className="calendar-event-desc" style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5', margin: '8px 0 16px' }}>{selectedEvent.description}</p>
              
              <div className="calendar-topics-section">
                <strong style={{ display: 'block', fontSize: '13px', marginBottom: 12 }}>品类选题推荐</strong>
                <div className="calendar-topic-cards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {selectedEvent.topics.map((topic, i) => (
                    <div className="calendar-topic-card" key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 8, border: '1px solid var(--line)' }}>
                      <p className="calendar-topic-text" style={{ fontSize: '13px', margin: '0 0 10px', lineHeight: '1.4' }}>{topic}</p>
                      <div className="calendar-topic-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {selectedEvent.platforms.map((p) => (
                          <button
                            key={p}
                            className="workspace-secondary"
                            style={{ fontSize: '11px', padding: '3px 8px', borderRadius: 4 }}
                            onClick={() => {
                              // 只走 URL：去掉 workspace 参数即关闭面板。这里不能再调 onClose()，
                              // 它会基于尚未提交的旧 location 再发一次 router.replace，把本次参数冲掉。
                              setQueryParams({
                                action: 'create',
                                platform: p,
                                brief: topic,
                                product_id: activeProductId,
                                workspace: null,
                              });
                            }}
                          >
                            去 {p === 'xhs' ? '小红书' : p === 'dy' ? '抖音' : p === 'amazon' ? 'Amazon' : p} 创作
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="calendar-scheduled-section" style={{ borderTop: '1px solid var(--line)', paddingTop: 20, marginTop: 20 }}>
              <div className="workspace-section-title">已排期发布内容</div>
              {scheduledAssets.length === 0 ? (
                <div className="workspace-empty" style={{ padding: '20px 0', fontSize: '12px' }}>此节点暂无排期内容。可在“内容资产”详情中为此节日设定发布日期。</div>
              ) : (
                <div className="calendar-scheduled-list" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {scheduledAssets.map((asset) => (
                    <div className="calendar-scheduled-item" key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--line)' }}>
                      <div className="scheduled-item-info" style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <span className="scheduled-date" style={{ fontSize: '11px', color: 'var(--coral)', background: 'rgba(255, 107, 107, 0.1)', padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace' }}>{asset.scheduled_at}</span>
                        <span className={`platform-badge mini ${asset.platform}`} style={{ fontSize: '10px', padding: '2px 4px', borderRadius: 4 }}>
                          {asset.platform === 'xhs' ? '小红书' : asset.platform === 'dy' ? '抖音' : asset.platform === 'amazon' ? 'Amazon' : asset.platform}
                        </span>
                        <strong
                          className="scheduled-title"
                          onClick={() => onSelectTab('content', asset.id)}
                          style={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}
                          title="跳转至内容详情"
                        >
                          {asset.name}
                        </strong>
                      </div>
                      <button
                        className="review-clear scheduled-cancel-btn"
                        style={{ color: 'var(--muted)', fontSize: '11px', padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={() => handleCancelSchedule(asset.id)}
                      >
                        取消排期
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="workspace-empty">选择营销节点查看选题推荐与排期。</div>
        )}
      </div>
    </div>
  );
}

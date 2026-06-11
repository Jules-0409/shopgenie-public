'use client';

import { useEffect, useMemo, useState } from 'react';
import ResultCard from './ResultCard';
import { batchGenerate, listProducts, type BatchResultItem, type Product, type UserProfile } from '@/lib/api';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';
import { toast } from '@/lib/toast';

const BATCH_PLATFORMS: Platform[] = ['xhs', 'dy', 'amazon', 'cs'];

export default function BatchView({ profile }: { profile: UserProfile | null }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string | null>(null);
  const [brief, setBrief] = useState('');
  const [selected, setSelected] = useState<Platform[]>(['xhs', 'dy', 'amazon']);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResultItem[] | null>(null);

  useEffect(() => { listProducts().then(setProducts).catch(() => undefined); }, []);

  const product = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);
  const canRun = !loading && selected.length > 0 && (brief.trim().length > 0 || !!product);

  const toggle = (p: Platform) => setSelected((cur) => cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]);

  const run = async () => {
    if (!canRun) return;
    setLoading(true);
    setResults(null);
    try {
      const items = await batchGenerate({ product_id: productId, brief: brief.trim() || (product ? `为${product.name}创作内容` : ''), platforms: selected });
      setResults(items);
      const ok = items.filter((i) => i.result).length;
      toast(`已为 ${ok}/${items.length} 个平台生成内容`, ok > 0 ? 'success' : 'error');
    } catch (error) {
      toast(error instanceof Error ? error.message : '批量生成失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="batch-view dot-grid">
      <div className="batch-inner">
        <div className="batch-form">
          <div className="batch-form-title">一次生成，铺满全平台</div>
          <p className="batch-form-sub">选一个商品或写一句描述，勾选平台，一键产出多平台内容，各自存进内容资产。</p>
          <label className="batch-field">商品（可选）
            <select value={productId ?? ''} onChange={(e) => setProductId(e.target.value || null)}>
              <option value="">不指定商品 · 仅用下方描述</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.category ? ` · ${p.category}` : ''}</option>)}
            </select>
          </label>
          <label className="batch-field">内容方向 / 描述
            <textarea value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={500} rows={3} placeholder={product ? '可留空，直接用商品事实库；或补充本次侧重点' : '例如：轻量保温杯，主打通勤、单手开盖、12 小时保温'} />
          </label>
          <div className="batch-field">
            <span>目标平台</span>
            <div className="batch-platforms">
              {BATCH_PLATFORMS.map((p) => (
                <button type="button" key={p} className={`batch-platform ${selected.includes(p) ? 'on' : ''}`} onClick={() => toggle(p)}>
                  {selected.includes(p) ? '✓ ' : ''}{PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <button className="batch-run" disabled={!canRun} onClick={run}>
            {loading ? `正在生成 ${selected.length} 个平台…` : `一键生成 ${selected.length} 个平台`}
          </button>
        </div>

        {loading && (
          <div className="batch-loading">
            {selected.map((p) => <div className="batch-skeleton" key={p}><span className="batch-skeleton-tag">{PLATFORM_LABELS[p]}</span><span className="studio-task-spinner" /></div>)}
          </div>
        )}

        {results && (
          <div className="batch-results">
            {results.map((item) => (
              <div className="batch-result-col" key={item.platform}>
                <div className="batch-result-head">{PLATFORM_LABELS[item.platform]}</div>
                {item.result
                  ? <ResultCard card={item.result} brandName={profile?.brand_name} quality={item.quality ?? undefined} warnings={item.warnings ?? undefined} />
                  : <div className="batch-result-fail">{item.error ?? item.message ?? '该平台未能生成可用成品'}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

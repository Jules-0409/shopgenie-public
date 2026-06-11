'use client';

import { useEffect, useState } from 'react';
import { AmazonMark, DyMark, XhsMark } from './Icons';
import { getPerformanceInsights, listExperiments, listProducts, type Experiment, type PerformanceInsights, type Product, type UserProfile } from '@/lib/api';
import type { Platform } from '@/lib/platforms';
import type { WorkspaceTab } from './WorkspacePanel';

const PLATFORMS = [
  {
    platform: 'xhs' as Platform,
    label: '小红书种草笔记',
    description: '真实分享感，包含标题、正文与话题标签',
    badge: '生活方式内容',
  },
  {
    platform: 'dy' as Platform,
    label: '抖音短视频脚本',
    description: '可直接拍摄，包含 Hook、分镜口播与转化引导',
    badge: '15–60 秒脚本',
  },
  {
    platform: 'amazon' as Platform,
    label: 'Amazon Listing',
    description: '英文商品详情，包含标题、Bullet Points 与描述',
    badge: '跨境电商',
  },
] satisfies Array<{ platform: Platform; label: string; description: string; badge: string }>;

const SCENARIOS = [
  {
    platform: 'cs' as Platform,
    label: '客服话术',
    description: '售前咨询 + 售后处理的标准化回复模板',
    icon: '💬',
  },
  {
    platform: 'studio' as Platform,
    label: '商品图工作室',
    description: '生成商品三视图 → 调整外观 → 一键换场景',
    icon: '📸',
  },
];

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'xhs') return <XhsMark s={18} />;
  if (platform === 'dy') return <DyMark s={18} />;
  if (platform === 'amazon') return <AmazonMark s={18} />;
  return <span style={{ fontSize: 18 }}>💬</span>;
};

const Preview = ({ platform, brandName }: { platform: Platform; brandName: string }) => {
  if (platform === 'xhs') {
    return (
      <div className="platform-mock xhs-mock">
        <div className="mock-user"><span /> {brandName} · 刚刚</div>
        <strong>干皮姐妹别划走！这个补水思路真的有用</strong>
        <p>真实使用场景 + 产品卖点 + 自然分享表达...</p>
        <div className="mock-tags">#面膜推荐　#补水护肤</div>
      </div>
    );
  }
  if (platform === 'dy') {
    return (
      <div className="platform-mock dy-mock">
        <div className="mock-timeline"><b>0–3s</b><span>Hook 抓住注意力</span></div>
        <div className="mock-timeline"><b>3–12s</b><span>分镜展示核心卖点</span></div>
        <div className="mock-timeline"><b>12–15s</b><span>自然转化引导</span></div>
      </div>
    );
  }
  return (
    <div className="platform-mock amazon-mock">
      <div className="amazon-search">amazon　Search products</div>
      <strong>Product Title With Key Features</strong>
      <div className="amazon-stars">★★★★★ <span>About this item</span></div>
      <ul><li>KEY BENEFIT — clear product fact</li><li>USE CASE — customer-focused detail</li></ul>
    </div>
  );
};

function OperationsHub({ onOpen }: { onOpen?: (tab: WorkspaceTab) => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);

  useEffect(() => {
    listProducts().then(setProducts).catch(() => undefined);
    listExperiments().then(setExperiments).catch(() => undefined);
    getPerformanceInsights().then(setInsights).catch(() => undefined);
  }, []);

  const analyzed = products.filter((p) => p.review_insights).length;
  const running = experiments.filter((e) => e.status === 'running').length;
  const decided = experiments.filter((e) => e.status === 'decided').length;

  const cards: Array<{ tab: WorkspaceTab; icon: string; label: string; stat: string; hint: string }> = [
    { tab: 'products', icon: '📦', label: '商品库', stat: `${products.length} 个商品`, hint: analyzed > 0 ? `${analyzed} 个已分析评论` : '粘贴买家评价，反哺生成' },
    { tab: 'experiments', icon: '🧪', label: 'A/B 实验', stat: running + decided > 0 ? `${running} 投放中 · ${decided} 已决出` : '还没有实验', hint: '标题/钩子变体竞速找赢家' },
    { tab: 'performance', icon: '📈', label: '效果洞察', stat: insights && insights.records > 0 ? `转化率 ${insights.conversion_rate}%` : '暂无数据', hint: insights && insights.records > 0 ? `${insights.records} 次发布回流` : '录入曝光转化，优化下一版' },
  ];

  return (
    <div className="ops-hub">
      <div className="ops-hub-head">
        <span className="scenario-label">你的运营台</span>
        <span className="ops-hub-sub">内容只是起点 — 评论反哺、A/B 实验、效果回流让它越用越准</span>
      </div>
      <div className="ops-hub-grid">
        {cards.map((c) => (
          <button className="ops-card" key={c.tab} onClick={() => onOpen?.(c.tab)}>
            <span className="ops-card-icon">{c.icon}</span>
            <div className="ops-card-body">
              <div className="ops-card-top"><strong>{c.label}</strong><span className="ops-card-stat">{c.stat}</span></div>
              <span className="ops-card-hint">{c.hint}</span>
            </div>
            <span className="ops-card-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function WelcomeScreen({ onSelect, profile, onProfileOpen, onOpenWorkspace, onBatch }: { onSelect: (platform: Platform, title: string) => void; profile: UserProfile | null; onProfileOpen?: () => void; onOpenWorkspace?: (tab: WorkspaceTab) => void; onBatch?: () => void }) {
  const brandName = profile?.brand_name || '你的品牌';
  const memoryItems = profile
    ? [profile.brand_name, profile.category, profile.tone, ...profile.style_preferences].filter(Boolean).slice(0, 4)
    : [];

  return (
    <div className="welcome dot-grid">
      <div className="platform-picker">
        <div className="welcome-eyebrow">Choose a publishing destination</div>
        <h1 className="welcome-title">准备为哪个平台创作？</h1>
        <p className="welcome-sub">每个平台使用独立的内容结构和规则。选择后，ShopGenie 会在这次对话中保持平台一致。</p>
        <div className="platform-preview-grid">
          {PLATFORMS.map((item) => (
            <button className={`platform-preview-card ${item.platform}`} key={item.platform} onClick={() => onSelect(item.platform, item.label)}>
              <div className="platform-preview-head">
                <span className="preview-icon"><PlatformIcon platform={item.platform} /></span>
                <span className="preview-badge">{item.badge}</span>
              </div>
              <Preview platform={item.platform} brandName={brandName} />
              <div className="platform-preview-copy">
                <strong>{item.label}</strong>
                <span>{item.description}</span>
              </div>
              <div className="preview-cta">使用这个平台 <span>→</span></div>
            </button>
          ))}
        </div>
        {onBatch && (
          <button className="batch-cta" onClick={onBatch}>
            <span className="batch-cta-icon">🚀</span>
            <div className="batch-cta-copy">
              <strong>一键全平台批量生成</strong>
              <span>选一个商品，同时产出小红书、抖音、Amazon 多平台内容</span>
            </div>
            <span className="batch-cta-arrow">→</span>
          </button>
        )}
        <OperationsHub onOpen={onOpenWorkspace} />
        <div className="scenario-section">
          <div className="scenario-label">更多场景</div>
          <div className="scenario-grid">
            {SCENARIOS.map((item) => (
              <button className="scenario-card" key={item.platform} onClick={() => onSelect(item.platform, item.label)}>
                <span className="scenario-icon">{item.icon}</span>
                <div className="scenario-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </div>
                <span className="scenario-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
        <div className={`memory-chip${!memoryItems.length && onProfileOpen ? ' clickable' : ''}`} onClick={!memoryItems.length && onProfileOpen ? onProfileOpen : undefined}>{memoryItems.length > 0 ? `● 已记住：${memoryItems.join(' · ')}` : '○ 设置品牌档案后，生成内容会更贴合你的风格'}</div>
      </div>
    </div>
  );
}

'use client';

import useSWR from 'swr';
import { swrKeys, swrFetcher } from '@/lib/swr-fetcher';
import { AmazonMark, DyMark, XhsMark, IconComment, IconBox, IconFlask, IconChart } from './Icons';
import { updateOperationActionState, type OperationsAction, type UserProfile } from '@/lib/api';
import { PLATFORM_LABELS, type ActivePlatform, type Platform } from '@/lib/platforms';
import type { WorkspaceTab } from './WorkspacePanel';

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'xhs') return <XhsMark s={16} />;
  if (platform === 'dy') return <DyMark s={16} />;
  if (platform === 'amazon') return <AmazonMark s={16} />;
  if (platform === 'cs') return <IconComment />;
  return null;
};

export function OperationsHub({ onOpen }: { onOpen?: (tab: WorkspaceTab, params?: { product_id?: string | null; asset_id?: string | null; platform?: string | null; brief?: string | null }) => void }) {
  const { data: brief, mutate: mutateBrief } = useSWR(swrKeys.brief, swrFetcher.brief);

  const handleActionClick = (action: OperationsAction) => {
    // action_params 拍平成可进 URL 的标量，供工作台预填（platform/brief）
    onOpen?.(action.target_tab, {
      product_id: action.product_id,
      asset_id: action.asset_id,
      platform: typeof action.action_params?.platform === 'string' ? action.action_params.platform : null,
      brief: typeof action.action_params?.brief === 'string' ? action.action_params.brief : null,
    });
  };

  const handleDismiss = async (actionId: string) => {
    try {
      await updateOperationActionState(actionId, 'dismissed');
      void mutateBrief();
    } catch (error) {
      console.error('Dismiss action failed:', error);
    }
  };

  return (
    <div className="ops-hub">
      <div className="ops-hub-head">
        <span className="scenario-label">今日运营指挥台</span>
        {brief && <span className={`ops-health ${brief.status}`}>{brief.status === 'healthy' ? '状态良好' : brief.status === 'attention' ? '需要关注' : '稳步推进'}</span>}
      </div>
      {brief && brief.actions.length > 0 && <div className="ops-action-list">{brief.actions.map((action, index) => (
        <div className={`ops-action ${action.priority}`} key={action.id}>
          <button className="ops-action-main" onClick={() => handleActionClick(action)}>
            <span className="ops-action-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="ops-action-copy"><strong>{action.title}</strong><span>{action.reason}</span></span>
            <span className="ops-action-metric">{action.metric}</span>
            <span className="ops-card-arrow">→</span>
          </button>
          <button className="ops-action-dismiss" onClick={() => handleDismiss(action.id)} title="忽略此建议">
            ×
          </button>
        </div>
      ))}</div>}
      {brief?.status === 'healthy' && <div className="ops-healthy-note">继续发布内容并回填真实数据，ShopGenie 会在出现异常信号时提醒你。</div>}
    </div>
  );
}

function AssetStats({ onOpen }: { onOpen?: (tab: WorkspaceTab) => void }) {
  const { data: products = [] } = useSWR(swrKeys.products, swrFetcher.products);
  const { data: experiments = [] } = useSWR(swrKeys.experiments, swrFetcher.experiments);
  const { data: insights } = useSWR(swrKeys.insights, swrFetcher.insights);

  const analyzed = products.filter((p) => p.review_insights).length;
  const running = experiments.filter((e) => e.status === 'running').length;
  const decided = experiments.filter((e) => e.status === 'decided').length;

  const cards = [
    { tab: 'products' as WorkspaceTab, Icon: IconBox, label: '商品库', stat: `${products.length} 个商品`, hint: analyzed > 0 ? `${analyzed} 个已分析评论` : '粘贴买家评价，反哺生成' },
    { tab: 'experiments' as WorkspaceTab, Icon: IconFlask, label: 'A/B 实验', stat: running + decided > 0 ? `${running} 投放中 · ${decided} 已决出` : '还没有实验', hint: '标题/钩子变体竞速找赢家' },
    { tab: 'performance' as WorkspaceTab, Icon: IconChart, label: '效果数据', stat: insights && insights.records > 0 ? `转化率 ${insights.conversion_rate}%` : '暂无数据', hint: insights && insights.records > 0 ? `${insights.records} 次发布回流` : '录入曝光转化，优化下一版' },
  ];

  return (
    <div className="ops-hub-grid">
      {cards.map((c) => (
        <button className="ops-card" key={c.tab} onClick={() => onOpen?.(c.tab)}>
          <span className="ops-card-icon"><c.Icon /></span>
          <div className="ops-card-body">
            <div className="ops-card-top"><strong>{c.label}</strong><span className="ops-card-stat">{c.stat}</span></div>
            <span className="ops-card-hint">{c.hint}</span>
          </div>
          <span className="ops-card-arrow">→</span>
        </button>
      ))}
    </div>
  );
}

function RecentAssets({ onOpen }: { onOpen?: (tab: WorkspaceTab, params?: { asset_id?: string | null }) => void }) {
  const { data: assets = [] } = useSWR(swrKeys.assets, swrFetcher.assets);
  if (assets.length === 0) return null;
  return (
    <div className="recent-assets">
      <div className="ops-hub-divider"><span>最近内容</span></div>
      <div className="recent-asset-list">
        {assets.slice(0, 4).map((asset) => (
          <button className="recent-asset" key={asset.id} onClick={() => onOpen?.('content', { asset_id: asset.id })}>
            <span className={`conversation-dot ${asset.platform}`} />
            <span className="recent-asset-name">{asset.name}</span>
            <span className="recent-asset-meta">{PLATFORM_LABELS[asset.platform]} · v{asset.current_version}</span>
            <span className="ops-card-arrow">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
};

interface WelcomeScreenProps {
  onSelect: (platform: ActivePlatform, title: string) => void;
  profile: UserProfile | null;
  onProfileOpen?: () => void;
  onOpenWorkspace?: (tab: WorkspaceTab, params?: { product_id?: string | null; asset_id?: string | null; platform?: string | null; brief?: string | null }) => void;
  onBatch?: () => void;
}

export default function WelcomeScreen({ onSelect, profile, onOpenWorkspace, onBatch }: WelcomeScreenProps) {
  const { data: brief } = useSWR(swrKeys.brief, swrFetcher.brief);

  return (
    <div className="cockpit-layout dot-grid">
      <div className="cockpit-main">
        <div className="cockpit-masthead">
          <h1 className="cockpit-greeting">{greeting()}，{profile?.brand_name || '店主'}</h1>
          <p className="cockpit-status">{brief?.summary ?? '正在诊断商品、内容与投放数据…'}</p>
        </div>
        <OperationsHub onOpen={onOpenWorkspace} />
        {(brief?.actions.length ?? 0) < 3 && <RecentAssets onOpen={onOpenWorkspace} />}

        {/* Quick Creator Row */}
        <div className="quick-creator">
          <div className="ops-hub-divider"><span>快捷创作入口</span></div>
          <div className="creator-grid">
            <button className="creator-btn xhs" onClick={() => onSelect('xhs', '小红书种草笔记')}>
              <span className="creator-icon"><PlatformIcon platform="xhs" /></span>
              <div className="creator-btn-copy">
                <strong>小红书笔记</strong>
                <span>种草与爆款标题生成</span>
              </div>
            </button>
            <button className="creator-btn dy" onClick={() => onSelect('dy', '抖音短视频脚本')}>
              <span className="creator-icon"><PlatformIcon platform="dy" /></span>
              <div className="creator-btn-copy">
                <strong>抖音视频</strong>
                <span>带货与宣传脚本创作</span>
              </div>
            </button>
            <button className="creator-btn amazon" onClick={() => onSelect('amazon', 'Amazon Listing')}>
              <span className="creator-icon"><PlatformIcon platform="amazon" /></span>
              <div className="creator-btn-copy">
                <strong>Amazon Listing</strong>
                <span>高转化标题与五点描述</span>
              </div>
            </button>
            <button className="creator-btn cs" onClick={() => onSelect('cs', '客服话术')}>
              <span className="creator-icon"><PlatformIcon platform="cs" /></span>
              <div className="creator-btn-copy">
                <strong>客服话术</strong>
                <span>多平台私信与回复模拟</span>
              </div>
            </button>
            {onBatch && (
              <button className="creator-btn batch" onClick={onBatch}>
                <span className="creator-icon">⚡</span>
                <div className="creator-btn-copy">
                  <strong>全平台生成</strong>
                  <span>一键产出多渠道内容</span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="cockpit-sidebar">
        <div className="ops-hub-divider"><span>运营资产概览</span></div>
        <AssetStats onOpen={onOpenWorkspace} />
      </div>
    </div>
  );
}

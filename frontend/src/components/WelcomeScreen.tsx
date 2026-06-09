'use client';

import { AmazonMark, DyMark, XhsMark } from './Icons';
import type { UserProfile } from '@/lib/api';
import type { Platform } from '@/lib/platforms';

const PLATFORMS = [
  {
    platform: 'xhs',
    label: '小红书种草笔记',
    description: '真实分享感，包含标题、正文与话题标签',
    badge: '生活方式内容',
  },
  {
    platform: 'dy',
    label: '抖音短视频脚本',
    description: '可直接拍摄，包含 Hook、分镜口播与转化引导',
    badge: '15–60 秒脚本',
  },
  {
    platform: 'amazon',
    label: 'Amazon Listing',
    description: '英文商品详情，包含标题、Bullet Points 与描述',
    badge: '跨境电商',
  },
] satisfies Array<{ platform: Platform; label: string; description: string; badge: string }>;

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'xhs') return <XhsMark s={18} />;
  if (platform === 'dy') return <DyMark s={18} />;
  return <AmazonMark s={18} />;
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

export default function WelcomeScreen({ onSelect, profile, onProfileOpen }: { onSelect: (platform: Platform, title: string) => void; profile: UserProfile | null; onProfileOpen?: () => void }) {
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
        <div className={`memory-chip${!memoryItems.length && onProfileOpen ? ' clickable' : ''}`} onClick={!memoryItems.length && onProfileOpen ? onProfileOpen : undefined}>{memoryItems.length > 0 ? `● 已记住：${memoryItems.join(' · ')}` : '○ 设置品牌档案后，生成内容会更贴合你的风格'}</div>
      </div>
    </div>
  );
}

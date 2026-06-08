'use client';

import { useState } from 'react';
import { AmazonMark, DyMark, IconCamera, IconComment, IconCopy, IconEdit, IconHeart, IconRefresh, IconStar, XhsMark } from './Icons';
import type { GeneratedContent } from '@/lib/api';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';

function renderPlaceholder(text: string) {
  const parts = text.split(/(\[待补充[^\]]*\])/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (part.startsWith('[待补充')) {
      const label = part.slice(4, -1) || '请补充';
      return <span key={index} className="placeholder-badge">{label}</span>;
    }
    return part;
  });
}

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'xhs') return <XhsMark />;
  if (platform === 'dy') return <DyMark />;
  return <AmazonMark />;
};

const XhsPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="xhs-phone">
    <div className="phone-status"><span>9:41</span><b>● ● ●</b></div>
    <div className="xhs-nav"><span>‹</span><strong>笔记预览</strong><span>•••</span></div>
    <div className="app-profile"><span>美</span><div><strong>XX美妆旗舰店</strong><small>上海 · 刚刚</small></div><b>关注</b></div>
    <div className="xhs-preview-cover"><IconCamera /><span>首图待添加 · 建议 3:4 竖图</span></div>
    <div className="app-content"><h2>{renderPlaceholder(card.title)}</h2><div className="app-body">{renderPlaceholder(card.body)}</div><div className="post-tags">{card.tags.map((tag) => <span className="post-tag" key={tag}>#{tag}</span>)}</div></div>
    <div className="xhs-actions"><span>说点什么...</span><IconHeart /><IconStar /><IconComment /></div>
  </div>
);

const DouyinPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="douyin-preview-shell">
    <div className="douyin-phone">
      <div className="dy-top"><span>推荐</span><b>关注</b><span>搜索</span></div>
      <div className="dy-camera"><IconCamera /><span>按分镜拍摄后在这里预览成片</span></div>
      <div className="dy-caption"><strong>@XX美妆旗舰店</strong><p>{card.title}</p><span>{card.tags.map((tag) => `#${tag}`).join(' ')}</span></div>
      <div className="dy-side-actions"><b>美</b><span>♡<small>点赞</small></span><span>○<small>评论</small></span><span>↗<small>分享</small></span></div>
    </div>
    <div className="dy-script-panel">
      <div className="script-panel-title"><span>拍摄脚本</span><b>{card.sections.length || 1} 个分镜</b></div>
      {(card.sections.length ? card.sections : [{ label: '完整脚本', content: card.body }]).map((section) => (
        <div className="script-section" key={section.label}><b>{section.label}</b><p>{renderPlaceholder(section.content)}</p></div>
      ))}
    </div>
  </div>
);

const AmazonPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="amazon-app-preview">
    <div className="amazon-app-header"><AmazonMark s={16} /> amazon <span>Search products</span></div>
    <div className="amazon-breadcrumb">Beauty & Personal Care › Product detail preview</div>
    <div className="amazon-product">
      <div className="amazon-gallery"><div className="amazon-thumbnails"><i /><i /><i /></div><div className="amazon-image"><IconCamera /><span>MAIN PRODUCT IMAGE</span></div></div>
      <div className="amazon-detail"><h2>{renderPlaceholder(card.title)}</h2><div className="amazon-rating">★★★★★</div><strong>About this item</strong>
        <ul>{(card.sections.length ? card.sections : [{ label: 'Product description', content: card.body }]).map((section) => <li key={section.label}><b>{section.label}:</b> {renderPlaceholder(section.content)}</li>)}</ul>
        <div className="amazon-description"><strong>Product description</strong><p>{renderPlaceholder(card.body)}</p></div>
      </div>
      <aside className="amazon-buybox"><span>Offer details not provided</span><b>In Stock</b><button>Add to Cart</button><button>Buy Now</button><small>Preview only · verify offer details before publishing</small></aside>
    </div>
  </div>
);

export default function ResultCard({ card }: { card: GeneratedContent }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(`${card.title}\n\n${card.body}\n\n${card.tags.map((tag) => `#${tag}`).join(' ')}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className={`result-card result-${card.platform}`}>
      <header className="result-toolbar">
        <div className="result-type"><PlatformIcon platform={card.platform} /> {PLATFORM_LABELS[card.platform]}应用预览</div>
        <div className="result-actions">
          <button className="action-button"><IconRefresh /> 再来一版</button>
          <button className="action-button"><IconEdit /> 编辑</button>
          <button className="action-button primary" onClick={copy}><IconCopy /> {copied ? '已复制' : '复制全文'}</button>
        </div>
      </header>
      <div className={`result-stage stage-${card.platform}`}>
        {card.platform === 'xhs' && <XhsPreview card={card} />}
        {card.platform === 'dy' && <DouyinPreview card={card} />}
        {card.platform === 'amazon' && <AmazonPreview card={card} />}
      </div>
      <footer className="result-footer"><span className="check">✓ 信息结构通过</span><span className="check">✓ 平台格式已适配</span><span className="tip">生成内容请在发布前核对产品事实</span></footer>
    </article>
  );
}

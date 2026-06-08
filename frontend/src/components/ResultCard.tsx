'use client';

import { useState } from 'react';
import { AmazonMark, DyMark, IconCopy, IconEdit, IconRefresh, XhsMark } from './Icons';
import type { GeneratedContent } from '@/lib/api';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'xhs') return <XhsMark />;
  if (platform === 'dy') return <DyMark />;
  return <AmazonMark />;
};

const XhsPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="app-preview xhs-app-preview">
    <div className="app-profile"><span>美</span><div><strong>XX美妆旗舰店</strong><small>上海 · 刚刚</small></div><b>关注</b></div>
    <div className="xhs-preview-cover"><span>封面图建议</span><strong>{card.title}</strong></div>
    <div className="app-content"><h2>{card.title}</h2><div className="app-body">{card.body}</div><div className="post-tags">{card.tags.map((tag) => <span className="post-tag" key={tag}>#{tag}</span>)}</div></div>
  </div>
);

const DouyinPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="app-preview douyin-app-preview">
    <div className="dy-video-stage"><span className="dy-duration">脚本预览</span><div className="dy-play">▶</div><h2>{card.title}</h2></div>
    <div className="dy-script-panel">
      {(card.sections.length ? card.sections : [{ label: '完整脚本', content: card.body }]).map((section) => (
        <div className="script-section" key={section.label}><b>{section.label}</b><p>{section.content}</p></div>
      ))}
    </div>
  </div>
);

const AmazonPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="app-preview amazon-app-preview">
    <div className="amazon-app-header"><AmazonMark s={16} /> amazon <span>Search products</span></div>
    <div className="amazon-product">
      <div className="amazon-image">Product image</div>
      <div className="amazon-detail"><h2>{card.title}</h2><div className="amazon-rating">★★★★★</div><strong>About this item</strong>
        <ul>{(card.sections.length ? card.sections : [{ label: 'Product description', content: card.body }]).map((section) => <li key={section.label}><b>{section.label}:</b> {section.content}</li>)}</ul>
        <p>{card.body}</p>
      </div>
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
      <div className="result-stage">
        {card.platform === 'xhs' && <XhsPreview card={card} />}
        {card.platform === 'dy' && <DouyinPreview card={card} />}
        {card.platform === 'amazon' && <AmazonPreview card={card} />}
      </div>
      <footer className="result-footer"><span className="check">✓ 信息结构通过</span><span className="check">✓ 平台格式已适配</span><span className="tip">生成内容请在发布前核对产品事实</span></footer>
    </article>
  );
}

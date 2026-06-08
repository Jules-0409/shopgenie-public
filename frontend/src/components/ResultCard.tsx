'use client';

import { useState } from 'react';
import { IconCamera, IconCopy, IconEdit, IconRefresh, XhsMark } from './Icons';
import type { Platform } from '@/lib/platforms';

export interface XHSNote {
  plat: Platform;
  type: string;
  title: string;
  body: string;
  tags: string[];
}

export default function ResultCard({ card }: { card: XHSNote }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const content = `${card.title}\n\n${card.body}\n\n${card.tags.map((tag) => `#${tag}`).join(' ')}`;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className="result-card">
      <header className="result-toolbar">
        <div className="result-type"><XhsMark /> {card.type}</div>
        <div className="result-actions">
          <button className="action-button"><IconRefresh /> 再来一版</button>
          <button className="action-button"><IconEdit /> 编辑</button>
          <button className="action-button primary" onClick={copy}><IconCopy /> {copied ? '已复制' : '复制全文'}</button>
        </div>
      </header>

      <div className="result-body">
        <div className="cover-panel">
          <div className="post-author">
            <div className="post-avatar">美</div>
            <div><strong>XX美妆旗舰店</strong><span>上海 · 刚刚</span></div>
          </div>
          <div className="cover-idea">
            <div className="cover-camera"><IconCamera /></div>
            <strong>真实分享，更容易被相信</strong>
            <span>建议使用敷前 / 敷后对比图作为首图</span>
          </div>
          <div className="cover-meta"><span>封面灵感</span><span>01 / 04</span></div>
        </div>

        <div className="post-panel">
          <div className="post-kicker">Ready to publish</div>
          <h2 className="post-title">{card.title}</h2>
          <div className="post-copy">{card.body}</div>
          <div className="post-tags">{card.tags.map((tag) => <span className="post-tag" key={tag}>#{tag}</span>)}</div>
        </div>
      </div>

      <footer className="result-footer">
        <span className="check">✓ 违禁词通过</span>
        <span className="check">✓ 平台规则合规</span>
        <span className="check">✓ {card.tags.length} 个标签已优化</span>
        <span className="tip">建议晚 8–10 点发布，前 30 分钟积极回复评论</span>
      </footer>
    </article>
  );
}

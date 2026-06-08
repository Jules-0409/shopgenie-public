'use client';

import { BrandMark, IconPlus } from './Icons';
import type { Platform } from '@/lib/platforms';

export interface ConversationSummary {
  id: string;
  title: string;
  platform: Platform;
}

interface SidebarProps {
  activeId: string | null;
  conversations: ConversationSummary[];
  mobileOpen: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export default function Sidebar({ activeId, conversations, mobileOpen, onClose, onSelect, onNew }: SidebarProps) {
  const select = (id: string) => {
    onSelect(id);
    onClose();
  };

  const create = () => {
    onNew();
    onClose();
  };

  return (
    <>
      {mobileOpen && <button aria-label="关闭导航" className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><BrandMark s={22} /></div>
          <div><div className="brand-name">ShopGenie</div><div className="brand-sub">商店精灵</div></div>
        </div>
        <button className="new-chat" onClick={create}><IconPlus /> 新对话</button>
        <div className="conversation-list">
          <section className="conversation-group">
            <div className="conversation-label">最近对话</div>
            {conversations.length === 0 && <div className="conversation-empty">还没有对话，开始第一条吧。</div>}
            {conversations.map((item) => (
              <button className={`conversation-item ${item.id === activeId ? 'active' : ''}`} key={item.id} onClick={() => select(item.id)}>
                <span className={`conversation-dot ${item.platform}`} />
                <span className="conversation-title">{item.title}</span>
              </button>
            ))}
          </section>
        </div>
        <div className="profile-card">
          <div className="profile-row">
            <div className="profile-avatar">美</div>
            <div><div className="profile-name">XX美妆</div><div className="profile-sub">护肤品 · 品牌档案</div></div>
          </div>
          <div className="profile-tags">{['真实感', '不要硬广', '小红书', '抖音', 'Amazon'].map((tag) => <span className="profile-tag" key={tag}>{tag}</span>)}</div>
        </div>
      </aside>
    </>
  );
}

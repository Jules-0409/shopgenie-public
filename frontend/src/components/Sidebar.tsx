'use client';

import { useState } from 'react';
import { BrandMark, IconPlus } from './Icons';
import type { Platform } from '@/lib/platforms';
import { PLATFORM_LABELS } from '@/lib/platforms';
import type { UserProfile } from '@/lib/api';

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
  onDelete: (id: string) => void;
  onProfileOpen: () => void;
  onWorkspaceOpen: () => void;
  profile: UserProfile | null;
}

export default function Sidebar({ activeId, conversations, mobileOpen, onClose, onSelect, onNew, onDelete, onProfileOpen, onWorkspaceOpen, profile }: SidebarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const select = (id: string) => {
    onSelect(id);
    onClose();
  };

  const create = () => {
    onNew();
    onClose();
  };

  const handleDelete = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  const profileTags = profile
    ? [profile.tone, ...profile.style_preferences, ...profile.platforms.map((item) => PLATFORM_LABELS[item])].filter(Boolean).slice(0, 5)
    : [];
  const profileName = profile?.brand_name || '设置品牌档案';
  const profileSub = profile?.category ? `${profile.category} · 品牌档案` : '添加资料，让生成更懂你';
  const avatar = profile?.brand_name.trim().slice(0, 1) || '+';

  return (
    <>
      {mobileOpen && <button aria-label="关闭导航" className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><BrandMark s={22} /></div>
          <div><div className="brand-name">ShopGenie</div><div className="brand-sub">商店精灵</div></div>
        </div>
        <button className="new-chat" onClick={create}><IconPlus /> 新对话</button>
        <button className="workspace-sidebar-button" onClick={() => { onWorkspaceOpen(); onClose(); }}><strong>OS</strong><span>内容工作台</span></button>
        <div className="conversation-list">
          <section className="conversation-group">
            <div className="conversation-label">最近对话</div>
            {conversations.length === 0 && <div className="conversation-empty">还没有对话，开始第一条吧。</div>}
            {conversations.map((item) => (
              <button className={`conversation-item ${item.id === activeId ? 'active' : ''}`} key={item.id} onClick={() => select(item.id)}>
                <span className={`conversation-dot ${item.platform}`} />
                <span className="conversation-title">{item.title}</span>
                <span
                  className={`conversation-delete${confirmDeleteId === item.id ? ' confirm' : ''}`}
                  onClick={(e) => handleDelete(item.id, e)}
                  title={confirmDeleteId === item.id ? '再点一次确认删除' : '删除对话'}
                >
                  {confirmDeleteId === item.id ? '确认?' : '×'}
                </span>
              </button>
            ))}
          </section>
        </div>
        <button className="profile-card" onClick={onProfileOpen}>
          <div className="profile-row">
            <div className="profile-avatar">{avatar}</div>
            <div className="profile-copy"><div className="profile-name">{profileName}</div><div className="profile-sub">{profileSub}</div></div>
            <span className="profile-edit">编辑</span>
          </div>
          {profileTags.length > 0 && <div className="profile-tags">{profileTags.map((tag) => <span className="profile-tag" key={tag}>{tag}</span>)}</div>}
        </button>
      </aside>
    </>
  );
}

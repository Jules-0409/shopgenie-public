'use client';

import { BrandMark, IconPlus } from './Icons';

const GROUPS = [
  { label: '今天', items: [{ id: 1, title: '玻尿酸面膜 · 种草笔记', plat: 'xhs' }, { id: 2, title: '连衣裙秋冬短视频脚本', plat: 'dy' }] },
  { label: '昨天', items: [{ id: 3, title: '口红测评文案', plat: 'xhs' }, { id: 4, title: '羽绒服上新商品标题', plat: 'dy' }, { id: 5, title: '护肤品套装合集推荐', plat: 'xhs' }] },
  { label: '更早', items: [{ id: 6, title: '店铺运营方案咨询', plat: null }] },
] as const;

interface SidebarProps {
  activeId: number | null;
  mobileOpen: boolean;
  onClose: () => void;
  onSelect: (id: number) => void;
  onNew: () => void;
}

export default function Sidebar({ activeId, mobileOpen, onClose, onSelect, onNew }: SidebarProps) {
  const select = (id: number) => {
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
        {GROUPS.map((group) => (
          <section className="conversation-group" key={group.label}>
            <div className="conversation-label">{group.label}</div>
            {group.items.map((item) => (
              <button className={`conversation-item ${item.id === activeId ? 'active' : ''}`} key={item.id} onClick={() => select(item.id)}>
                {item.plat && <span className={`conversation-dot ${item.plat}`} />}
                <span className="conversation-title">{item.title}</span>
              </button>
            ))}
          </section>
        ))}
      </div>
      <div className="profile-card">
        <div className="profile-row">
          <div className="profile-avatar">美</div>
          <div><div className="profile-name">XX美妆</div><div className="profile-sub">护肤品 · 品牌档案</div></div>
        </div>
        <div className="profile-tags">{['真实感', '不要硬广', '小红书', '抖音'].map((tag) => <span className="profile-tag" key={tag}>{tag}</span>)}</div>
      </div>
    </aside>
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface UserProfile {
  brand_name: string;
  category: string;
  target_audience: string;
  tone: string;
  style_preferences: string[];
  platforms: string[];
  taboo_words: string[];
  extra_notes: string;
}

const EMPTY_PROFILE: UserProfile = {
  brand_name: '',
  category: '',
  target_audience: '',
  tone: '',
  style_preferences: [],
  platforms: [],
  taboo_words: [],
  extra_notes: '',
};

export default function ProfilePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) setProfile(data.profile);
        else setProfile(EMPTY_PROFILE);
      })
      .catch(() => setProfile(EMPTY_PROFILE));
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>品牌档案</h2>
          <span>ShopGenie 会记住这些信息，越用越懂你</span>
        </div>
        <div className="profile-form">
          <label>
            <span>品牌名</span>
            <input value={profile.brand_name} onChange={(e) => setProfile({ ...profile, brand_name: e.target.value })} placeholder="XX美妆旗舰店" />
          </label>
          <label>
            <span>主营品类</span>
            <input value={profile.category} onChange={(e) => setProfile({ ...profile, category: e.target.value })} placeholder="护肤品、食品、3C配件…" />
          </label>
          <label>
            <span>目标人群</span>
            <input value={profile.target_audience} onChange={(e) => setProfile({ ...profile, target_audience: e.target.value })} placeholder="25-35岁女性、大学生…" />
          </label>
          <label>
            <span>品牌调性</span>
            <input value={profile.tone} onChange={(e) => setProfile({ ...profile, tone: e.target.value })} placeholder="真实感、精致、搞笑…" />
          </label>
          <label>
            <span>风格偏好</span>
            <input value={profile.style_preferences.join('、')} onChange={(e) => setProfile({ ...profile, style_preferences: e.target.value.split('、').filter(Boolean) })} placeholder="不要硬广、像朋友聊天（用顿号分隔）" />
          </label>
          <label>
            <span>禁忌词</span>
            <input value={profile.taboo_words.join('、')} onChange={(e) => setProfile({ ...profile, taboo_words: e.target.value.split('、').filter(Boolean) })} placeholder="绝对不能出现的词（用顿号分隔）" />
          </label>
          <label>
            <span>备注</span>
            <textarea value={profile.extra_notes} onChange={(e) => setProfile({ ...profile, extra_notes: e.target.value })} placeholder="其他想让 ShopGenie 知道的信息…" rows={3} />
          </label>
        </div>
        <div className="profile-footer">
          <button className="profile-cancel" onClick={onClose}>关闭</button>
          <button className="profile-save" onClick={save} disabled={saving}>
            {saved ? '✓ 已保存' : saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

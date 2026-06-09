'use client';

import { useEffect, useState } from 'react';
import { EMPTY_PROFILE, getProfile, saveProfile, type UserProfile } from '@/lib/api';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';

interface ProfilePanelProps {
  open: boolean;
  onClose: () => void;
  onSaved: (profile: UserProfile) => void;
}

const PLATFORM_OPTIONS = Object.entries(PLATFORM_LABELS) as [Platform, string][];
const splitItems = (value: string) => value.split(/[、,，]/).map((item) => item.trim()).filter(Boolean);

export default function ProfilePanel({ open, onClose, onSaved }: ProfilePanelProps) {
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [styleText, setStyleText] = useState('');
  const [tabooText, setTabooText] = useState('');

  useEffect(() => {
    if (!open) return;
    getProfile()
      .then((data) => {
        const loaded = data ?? EMPTY_PROFILE;
        setProfile(loaded);
        setStyleText(loaded.style_preferences.join('、'));
        setTabooText(loaded.taboo_words.join('、'));
        setError('');
      })
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : '品牌档案加载失败'));
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const savedProfile = await saveProfile({
        ...profile,
        style_preferences: splitItems(styleText),
        taboo_words: splitItems(tabooText),
      });
      setProfile(savedProfile);
      setStyleText(savedProfile.style_preferences.join('、'));
      setTabooText(savedProfile.taboo_words.join('、'));
      onSaved(savedProfile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '品牌档案保存失败');
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (platform: Platform) => {
    setProfile((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
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
            <input value={styleText} onChange={(e) => setStyleText(e.target.value)} placeholder="不要硬广、像朋友聊天（用顿号或逗号分隔）" />
          </label>
          <fieldset className="profile-platforms">
            <legend>常用平台</legend>
            <div>
              {PLATFORM_OPTIONS.map(([value, label]) => (
                <button type="button" className={profile.platforms.includes(value) ? 'selected' : ''} key={value} onClick={() => togglePlatform(value)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>禁忌词 <small>生成后会自动检测</small></span>
            <input value={tabooText} onChange={(e) => setTabooText(e.target.value)} placeholder="绝对不能出现的词（用顿号或逗号分隔）" />
          </label>
          <label>
            <span>备注</span>
            <textarea value={profile.extra_notes} onChange={(e) => setProfile({ ...profile, extra_notes: e.target.value })} placeholder="其他想让 ShopGenie 知道的信息…" rows={3} />
          </label>
        </div>
        {error && <div className="profile-error">{error}</div>}
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

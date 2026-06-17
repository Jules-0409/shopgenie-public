'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from './Icons';
import { ChatProvider } from '@/context/ChatContext';
import {
  clearAuthToken,
  getAuthToken,
  getCurrentAuthUser,
  loginWithAccessCode,
  setAuthToken,
  type AuthUser,
} from '@/lib/api';

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      Promise.resolve().then(() => setChecking(false));
      return;
    }
    getCurrentAuthUser()
      .then(setUser)
      .catch(() => {
        clearAuthToken();
        setUser(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = accessCode.trim();
    if (!code) {
      setError('请输入访问码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const nextUser = await loginWithAccessCode(code);
      setAuthToken(code);
      setUser(nextUser);
      setAccessCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '访问码无效');
      clearAuthToken();
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    clearAuthToken();
    window.localStorage.removeItem('shopgenie.conversations.v2');
    window.sessionStorage.removeItem('shopgenie.draft');
    window.location.reload();
  };

  if (checking) {
    return (
      <div className="auth-shell dot-grid">
        <div className="auth-card auth-status">正在验证访问权限...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-shell dot-grid">
        <form className="auth-card" onSubmit={submit}>
          <div className="auth-brand">
            <span className="brand-mark"><BrandMark s={24} /></span>
            <div>
              <h1>ShopGenie</h1>
              <p>输入访问码进入你的运营工作台</p>
            </div>
          </div>
          <label className="auth-field">
            <span>访问码</span>
            <input
              autoFocus
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="请输入访问码"
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={submitting} type="submit">
            {submitting ? '正在进入...' : '进入 ShopGenie'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <ChatProvider defaultProductId={null}>
      <div className="auth-session">
        <span>{user.user_id}</span>
        <button onClick={logout} type="button">退出</button>
      </div>
      {children}
    </ChatProvider>
  );
}

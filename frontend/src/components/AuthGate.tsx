'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { BrandMark } from './Icons';
import { ChatProvider } from '@/context/ChatContext';
import {
  clearAuthToken,
  getAuthToken,
  getCurrentAuthUser,
  loginWithPassword,
  registerAccount,
  setAuthToken,
  type AuthUser,
} from '@/lib/api';

interface AuthGateProps {
  children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('请输入账号和密码');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const nextUser = mode === 'register'
        ? await registerAccount(cleanUsername, password)
        : await loginWithPassword(cleanUsername, password);
      if (!nextUser.token) throw new Error('登录响应缺少 token');
      setAuthToken(nextUser.token);
      setUser(nextUser);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
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
              <p>{mode === 'login' ? '登录你的运营工作台' : '创建一个新的商家账号'}</p>
            </div>
          </div>
          <div className={`auth-tabs ${mode === 'register' ? 'register' : 'login'}`} role="tablist" aria-label="登录方式">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }} type="button">登录</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }} type="button">注册</button>
          </div>
          <label className="auth-field">
            <span>账号</span>
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="字母、数字、下划线或短横线"
            />
          </label>
          <label className="auth-field">
            <span>密码</span>
            <input
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'register' ? '至少 6 位' : '请输入密码'}
            />
          </label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={submitting} type="submit">
            {submitting ? '处理中...' : mode === 'login' ? '登录' : '注册并进入'}
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

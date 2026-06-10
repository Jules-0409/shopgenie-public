'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ChatBubble from '@/components/ChatBubble';
import { AmazonMark, BrandMark, DyMark, XhsMark } from '@/components/Icons';
import InputBar from '@/components/InputBar';
import ProfilePanel from '@/components/ProfilePanel';
import Sidebar, { type ConversationSummary } from '@/components/Sidebar';
import WelcomeScreen from '@/components/WelcomeScreen';
import WorkspacePanel from '@/components/WorkspacePanel';
import StudioView from '@/components/StudioView';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';
import { getProfile, listProducts, type Product, type UserProfile } from '@/lib/api';
import { useChat, DEMO_CONVERSATION } from '@/hooks/useChat';

const starterText: Record<Platform, string> = {
  xhs: '我想写一篇小红书种草笔记，产品是：',
  dy: '我想写一个抖音短视频脚本，产品是：',
  amazon: 'I want to create an Amazon listing. Product facts: ',
  cs: '我需要客服话术，商品是：',
  studio: '',
};

export default function Home() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState<'chat' | 'welcome' | 'studio'>('chat');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [defaultProductId, setDefaultProductId] = useState<string | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceAssetId, setWorkspaceAssetId] = useState<string | null>(null);
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = useChat(defaultProductId);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
    listProducts().then((items) => {
      setProducts(items);
      if (items.length > 0) setDefaultProductId(items[0].id);
    }).catch(() => setProducts([]));
  }, []);

  useEffect(() => { chat.hydrate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 输入草稿防刷新丢失（sessionStorage：标签页内有效）
  useEffect(() => {
    // 异步恢复草稿，规避 set-state-in-effect 的级联渲染
    Promise.resolve().then(() => {
      try { const saved = window.sessionStorage.getItem('shopgenie.draft'); if (saved) setDraft(saved); } catch { /* ignore */ }
    });
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('shopgenie.draft', draft); } catch { /* ignore */ }
  }, [draft]);

  useEffect(() => { chat.persist(); }, [chat.conversations, chat.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat.messages, view]);

  const summaries: ConversationSummary[] = useMemo(
    () => chat.conversations.map(({ id, title, platform }) => ({ id, title, platform })),
    [chat.conversations],
  );

  const openChat = (id: string) => {
    chat.setActiveId(id);
    setDraft('');
    setPendingPlatform(null);
    // Check if the target conversation is a studio one
    const target = chat.conversations.find((c) => c.id === id);
    setView(target?.platform === 'studio' ? 'studio' : 'chat');
  };

  const newChat = () => {
    setDraft('');
    setPendingPlatform(null);
    chat.setActiveId(null);
    setView('welcome');
  };

  const startFromPlatform = (actionPlatform: Platform, _title: string) => {
    if (actionPlatform === 'studio') {
      // 清掉当前活跃会话，避免 Studio 状态写进聊天会话
      chat.setActiveId(null);
      setView('studio');
      return;
    }
    setPendingPlatform(actionPlatform);
    setDraft(starterText[actionPlatform]);
    chat.setActiveId(null);
    setView('chat');
  };

  const displayPlatform = chat.activeConversation ? chat.platform : (pendingPlatform ?? 'xhs');

  const handleSend = (text: string, imageUrl?: string) => {
    if (!chat.activeConversation && pendingPlatform) {
      chat.send(text, imageUrl, pendingPlatform);
      setPendingPlatform(null);
    } else {
      chat.send(text, imageUrl);
    }
    setDraft('');
  };

  const platformIcon = (p: Platform) => {
    if (p === 'xhs') return <XhsMark />;
    if (p === 'dy') return <DyMark />;
    if (p === 'amazon') return <AmazonMark />;
    if (p === 'cs') return <span style={{ fontSize: 14 }}>💬</span>;
    if (p === 'studio') return <span style={{ fontSize: 14 }}>📸</span>;
    return null;
  };

  return (
    <div className="app-shell">
      <Sidebar activeId={chat.activeId} conversations={summaries} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onNew={newChat} onSelect={openChat} onDelete={chat.deleteConversation} onProfileOpen={() => setProfileOpen(true)} onWorkspaceOpen={() => { setWorkspaceAssetId(null); setWorkspaceOpen(true); }} profile={profile} />
      <main className="main-shell">
        {/* ── Studio View ── */}
        {view === 'studio' ? (
          <>
            <header className="topbar">
              <div className="topbar-inner">
                <button aria-label="打开导航" className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)}><BrandMark s={18} /></button>
                <span className="platform-pill studio">{platformIcon('studio')}商品图工作室</span>
                <span className="topbar-title">{chat.activeConversation?.platform === 'studio' ? chat.activeConversation.title : '新建商品图'}</span>
                <button className="icon-button" style={{ marginLeft: 'auto', fontSize: 13, width: 'auto', padding: '0 10px' }} onClick={newChat}>← 返回</button>
              </div>
            </header>
            <StudioView chat={chat} />
          </>
        ) : (
          <>
            <header className="topbar">
              <div className="topbar-inner">
                <button aria-label="打开导航" className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)}><BrandMark s={18} /></button>
                {view === 'chat' && (chat.activeConversation || pendingPlatform) ? (
                  <>
                    <span className={`platform-pill ${displayPlatform}`}>
                      {platformIcon(displayPlatform)}
                      {PLATFORM_LABELS[displayPlatform]}
                    </span>
                    <span className="topbar-title">{chat.activeConversation ? chat.activeConversation.title : '新对话'}</span>
                    {chat.activeProductId && <span className="active-product-chip">{products.find((item) => item.id === chat.activeProductId)?.name ?? '商品事实'}</span>}
                  </>
                ) : <span className="topbar-title">开始一段新对话</span>}
              </div>
            </header>

            {view === 'chat' && (chat.activeConversation || pendingPlatform) ? (
              <div className="chat-scroll dot-grid" ref={scrollRef}>
                <div className="messages">
                  {chat.messages.length === 0 && <div className="empty-chat">这是一个新对话。告诉我商品信息、平台和你想要的内容类型。</div>}
                  {chat.messages.map((message, index) => {
                    const isLastAI = message.role === 'ai' && !message.status && !message.demo && (index === chat.messages.length - 1 || chat.messages.slice(index + 1).every((m) => m.role === 'user' || m.demo));
                    return (
                      <ChatBubble
                        key={message.id}
                        msg={message}
                        brandName={profile?.brand_name}
                        onOptionSelect={message.questions ? (text) => chat.send(text) : undefined}
                        onRegenerate={isLastAI ? chat.regenerate : undefined}
                        onEditAsset={(assetId) => { setWorkspaceAssetId(assetId); setWorkspaceOpen(true); }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : <WelcomeScreen onSelect={startFromPlatform} profile={profile} onProfileOpen={() => setProfileOpen(true)} />}

            {view === 'chat' && (chat.activeConversation || pendingPlatform) && (
              <InputBar onSend={handleSend} onTextChange={setDraft} pending={chat.pending} text={draft} onStop={chat.stop} />
            )}
          </>
        )}
      </main>
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={setProfile} />
      <WorkspacePanel open={workspaceOpen} onClose={() => { setWorkspaceOpen(false); listProducts().then(setProducts).catch(() => undefined); }} activeProductId={chat.activeProductId} onActiveProductChange={(productId) => {
        setDefaultProductId(productId);
        chat.setActiveProduct(productId);
      }} targetAssetId={workspaceAssetId} />
    </div>
  );
}

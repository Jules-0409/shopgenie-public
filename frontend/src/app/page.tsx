'use client';

import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { swrKeys, swrFetcher } from '@/lib/swr-fetcher';
import { useChatContext } from '@/context/ChatContext';
import ChatBubble from '@/components/ChatBubble';
import { AmazonMark, BrandMark, DyMark, XhsMark, IconComment, IconCamera } from '@/components/Icons';
import InputBar from '@/components/InputBar';
import ProfilePanel from '@/components/ProfilePanel';
import Sidebar, { type ConversationSummary } from '@/components/Sidebar';
import WelcomeScreen from '@/components/WelcomeScreen';
import WorkspacePanel, { type WorkspaceTab } from '@/components/WorkspacePanel';
import StudioView from '@/components/StudioView';
import BatchView from '@/components/BatchView';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';
import { getProfile, type Product, type UserProfile } from '@/lib/api';
import { isProductContextLocked } from '@/hooks/useChat';

const starterText: Record<Platform, string> = {
  xhs: '我想写一篇小红书种草笔记，产品是：',
  dy: '我想写一个抖音短视频脚本，产品是：',
  amazon: 'I want to create an Amazon listing. Product facts: ',
  cs: '我需要客服话术，商品是：',
  studio: '',
};

function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chat = useChatContext();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState<'chat' | 'welcome' | 'studio' | 'batch'>('chat');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // Use SWR cache instead of local states
  const { data: products = [] } = useSWR(swrKeys.products, swrFetcher.products);
  
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [workspaceAssetId, setWorkspaceAssetId] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab | undefined>(undefined);
  const [pendingPlatform, setPendingPlatform] = useState<Platform | null>(null);
  const [workspacePrefill, setWorkspacePrefill] = useState<{
    product_id?: string | null;
    asset_id?: string | null;
    platform?: Platform | null;
    brief?: string | null;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to update search params and trigger navigation changes
  const setQueryParams = (params: Record<string, string | null>) => {
    const nextParams = new URLSearchParams(window.location.search);
    Object.entries(params).forEach(([key, val]) => {
      if (val === null) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, val);
      }
    });
    const query = nextParams.toString();
    const pathname = window.location.pathname.replace(/^\/shopgenie/, '') || '/';
    const url = `${pathname}${query ? `?${query}` : ''}`;
    router.replace(url, { scroll: false });
  };

  // Sync workspace and prefill states from URL Search Parameters (Deep Linking)
  useEffect(() => {
    const ws = searchParams.get('workspace') as WorkspaceTab | null;
    const aid = searchParams.get('asset_id');
    const pid = searchParams.get('product_id');
    const plat = searchParams.get('platform') as Platform | null;
    const brf = searchParams.get('brief');

    // 异步应用，规避 set-state-in-effect 的级联渲染（与草稿恢复同一惯例）
    Promise.resolve().then(() => {
      if (ws) {
        setWorkspaceTab(ws);
        setWorkspaceAssetId(aid);
        if (pid) {
          chat.setActiveProduct(pid);
        }
        setWorkspacePrefill({
          product_id: pid,
          asset_id: aid,
          platform: plat,
          brief: brf,
        });
        setWorkspaceOpen(true);
      } else {
        setWorkspaceOpen(false);
        setWorkspacePrefill(null);
        setWorkspaceAssetId(null);
      }
    });
  }, [searchParams, chat]);

  // Handle marketing calendar topic creation redirection
  useEffect(() => {
    const action = searchParams.get('action');
    const plat = searchParams.get('platform') as Platform | null;
    const brf = searchParams.get('brief');
    const pid = searchParams.get('product_id');

    if (action === 'create' && plat && brf) {
      // Clear URL query parameters to close drawer and avoid infinite trigger
      setQueryParams({ action: null, workspace: null, platform: null, brief: null, product_id: null });

      if (pid) {
        chat.setActiveProduct(pid);
      }

      const prod = products.find((p) => p.id === pid);
      const prodName = prod ? prod.name : '';
      let promptText = '';
      if (plat === 'xhs') {
        promptText = `我想写一篇小红书种草笔记，围绕选题“${brf}”，产品是：${prodName || '（请选择商品）'}`;
      } else if (plat === 'dy') {
        promptText = `我想写一个抖音短视频脚本，围绕选题“${brf}”，产品是：${prodName || '（请选择商品）'}`;
      } else if (plat === 'amazon') {
        promptText = `I want to create an Amazon listing for the topic "${brf}". Product facts: ${prodName ? `${prodName} facts...` : ''}`;
      } else {
        promptText = `我想针对“${brf}”选题生成内容，产品是：${prodName || '（请选择商品）'}`;
      }

      Promise.resolve().then(() => {
        setPendingPlatform(plat);
        setDraft(promptText);
        chat.setActiveId(null);
        setView('chat');
      });
    }
  }, [searchParams, products, chat]);

  useEffect(() => {
    getProfile().then(setProfile).catch(() => setProfile(null));
  }, []);

  // 输入草稿防刷新丢失（sessionStorage：标签页内有效）
  useEffect(() => {
    Promise.resolve().then(() => {
      try { const saved = window.sessionStorage.getItem('shopgenie.draft'); if (saved) setDraft(saved); } catch { /* ignore */ }
    });
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('shopgenie.draft', draft); } catch { /* ignore */ }
  }, [draft]);

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
    if (p === 'cs') return <IconComment />;
    if (p === 'studio') return <IconCamera />;
    return null;
  };

  return (
    <div className="app-shell">
      <Sidebar activeId={chat.activeId} conversations={summaries} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onNew={newChat} onSelect={openChat} onDelete={chat.deleteConversation} onProfileOpen={() => setProfileOpen(true)} onWorkspaceOpen={() => setQueryParams({ workspace: 'products' })} profile={profile} />
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
        ) : view === 'batch' ? (
          <>
            <header className="topbar">
              <div className="topbar-inner">
                <button aria-label="打开导航" className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)}><BrandMark s={18} /></button>
                <span className="platform-pill">批量生成</span>
                <span className="topbar-title">一键全平台</span>
                <button className="icon-button" style={{ marginLeft: 'auto', fontSize: 13, width: 'auto', padding: '0 10px' }} onClick={newChat}>← 返回</button>
              </div>
            </header>
            <BatchView profile={profile} />
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
                        onEditAsset={(assetId) => setQueryParams({ workspace: 'content', asset_id: assetId })}
                        onTweakVariant={
                          message.card?.platform === 'cs'
                            ? (label, tweak) => handleSend(`微调客服话术：针对“${label}”场景的回复进行微调，要求是：${tweak}`)
                            : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ) : <WelcomeScreen onSelect={startFromPlatform} profile={profile} onProfileOpen={() => setProfileOpen(true)} onOpenWorkspace={(tab, params) => setQueryParams({ workspace: tab, ...params })} onBatch={() => { chat.setActiveId(null); setPendingPlatform(null); setView('batch'); }} />}

            {view === 'chat' && (chat.activeConversation || pendingPlatform) && (
              <>
                {(() => {
                  const product = products.find((p) => p.id === chat.activeProductId);
                  const ins = product && product.review_insights?.product_id === product.id ? product.review_insights : null;
                  const loved = ins?.loved_points ?? [];
                  if (loved.length === 0) return null;
                  return (
                    <button className="ctx-insight-strip" onClick={() => setQueryParams({ workspace: 'products' })}>
                      <span className="ctx-insight-tag">正在参考评论洞察</span>
                      <span className="ctx-insight-points">{loved.slice(0, 3).join(' · ')}</span>
                      <span className="ctx-insight-arrow">管理 →</span>
                    </button>
                  );
                })()}
                <InputBar onSend={handleSend} onTextChange={setDraft} pending={chat.pending} text={draft} onStop={chat.stop} />
              </>
            )}
          </>
        )}
      </main>
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} onSaved={setProfile} />
      <WorkspacePanel open={workspaceOpen} initialTab={workspaceTab} onClose={() => {
        setQueryParams({ workspace: null, asset_id: null, product_id: null, platform: null, brief: null });
      }} activeProductId={chat.activeProductId} productContextLocked={isProductContextLocked(chat.activeConversation)} onActiveProductChange={(productId) => {
        chat.setActiveProduct(productId);
      }} targetAssetId={workspaceAssetId} prefillParams={workspacePrefill} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="dot-grid" style={{ height: '100vh', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontFamily: 'var(--system)', fontSize: '13px' }}>正在载入商店精灵...</div>}>
      <Home />
    </Suspense>
  );
}

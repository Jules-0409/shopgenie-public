'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ChatBubble, { type Message } from '@/components/ChatBubble';
import { AmazonMark, BrandMark, DyMark, IconHistory, IconShare, XhsMark } from '@/components/Icons';
import InputBar from '@/components/InputBar';
import type { XHSNote } from '@/components/ResultCard';
import Sidebar, { type ConversationSummary } from '@/components/Sidebar';
import WelcomeScreen from '@/components/WelcomeScreen';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';
import { sendChat } from '@/lib/api';

interface Conversation {
  id: string;
  title: string;
  platform: Platform;
  messages: Message[];
}

const STORAGE_KEY = 'shopgenie.conversations.v1';

const NOTE: XHSNote = {
  plat: 'xhs',
  type: '小红书种草笔记',
  title: '干皮姐妹别划走！敷完这个面膜我室友问我打了水光针 💧',
  body: `这是一个演示样例，用来展示结果卡片长什么样。

真实生成已经接入后端：点击“新对话”，输入你的商品事实，我会基于真实信息生成内容；信息不足时会先追问，不会硬编。`,
  tags: ['面膜推荐', '补水面膜', '敏感肌护肤', '干皮救星'],
};

const DEMO_CONVERSATION: Conversation = {
  id: 'demo-xhs',
  title: '玻尿酸面膜 · 种草笔记',
  platform: 'xhs',
  messages: [
    { id: 'demo-user', role: 'user', text: '帮我写个小红书笔记，玻尿酸补水面膜，真实分享风格', demo: true },
    { id: 'demo-ai', role: 'ai', text: '这是演示卡片。真实生成请点“新对话”后输入商品信息。', card: NOTE, demo: true },
  ],
};

const starterText: Record<Platform, string> = {
  xhs: '我想写一篇小红书种草笔记，产品是：',
  dy: '我想写一个抖音短视频脚本，产品是：',
  amazon: 'I want to create an Amazon listing. Product facts: ',
};

const titleFromMessage = (text: string, platform: Platform) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean) return clean.length > 18 ? `${clean.slice(0, 18)}…` : clean;
  return `${PLATFORM_LABELS[platform]} 新对话`;
};

export default function Home() {
  const [activeId, setActiveId] = useState<string | null>('demo-xhs');
  const [conversations, setConversations] = useState<Conversation[]>([DEMO_CONVERSATION]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<'chat' | 'welcome'>('chat');
  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Conversation[];
          if (Array.isArray(saved) && saved.length > 0) {
            setConversations([...saved, DEMO_CONVERSATION]);
            setActiveId(saved[0].id);
            setView('chat');
            idCounter.current = saved.reduce((total, conversation) => total + conversation.messages.length, saved.length) + 100;
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const serializable = conversations.filter((conversation) => conversation.id !== 'demo-xhs');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [conversations, hydrated]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId) ?? null;
  const platform = activeConversation?.platform ?? 'xhs';
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);
  const summaries: ConversationSummary[] = useMemo(
    () => conversations.map(({ id, title, platform: conversationPlatform }) => ({ id, title, platform: conversationPlatform })),
    [conversations],
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, view]);

  const createConversation = (platformChoice: Platform, title = `${PLATFORM_LABELS[platformChoice]} 新对话`) => {
    const conversation: Conversation = {
      id: `conversation-${idCounter.current++}`,
      title,
      platform: platformChoice,
      messages: [],
    };
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    setView('chat');
    return conversation;
  };

  const openChat = (id: string) => {
    setActiveId(id);
    setDraft('');
    setView('chat');
  };

  const newChat = () => {
    setActiveId(null);
    setDraft('');
    setView('welcome');
  };

  const startFromPlatform = (actionPlatform: Platform, title: string) => {
    const conversation = createConversation(actionPlatform, `${title} · 新对话`);
    setDraft(starterText[actionPlatform]);
    setActiveId(conversation.id);
  };

  const appendMessage = (conversationId: string, message: Message) => {
    setConversations((current) => current.map((conversation) => (
      conversation.id === conversationId
        ? { ...conversation, messages: [...conversation.messages, message] }
        : conversation
    )));
  };

  const replacePending = (conversationId: string, pendingId: string, message: Message) => {
    setConversations((current) => current.map((conversation) => (
      conversation.id === conversationId
        ? { ...conversation, messages: [...conversation.messages.filter((item) => item.id !== pendingId), message] }
        : conversation
    )));
  };

  const send = async (text: string) => {
    if (pending) return;
    const conversation = activeConversation ?? createConversation(platform);
    const conversationId = conversation.id;
    const requestPlatform = conversation.platform;
    const history = conversation.messages.filter((message) => !message.demo && !message.status).slice(-10).map((message) => ({
      role: message.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: message.text,
    }));

    setDraft('');
    setView('chat');
    setPending(true);
    const userMessage: Message = { id: `message-${idCounter.current++}`, role: 'user', text };
    const pendingMessage: Message = { id: `message-${idCounter.current++}`, role: 'ai', text: '正在为你生成可直接使用的内容…', status: 'pending' };
    appendMessage(conversationId, userMessage);
    appendMessage(conversationId, pendingMessage);
    setConversations((current) => current.map((item) => (
      item.id === conversationId && item.title.endsWith('新对话')
        ? { ...item, title: titleFromMessage(text, requestPlatform) }
        : item
    )));

    try {
      const response = await sendChat(requestPlatform, text, history);
      replacePending(conversationId, pendingMessage.id, { id: `message-${idCounter.current++}`, role: 'ai', text: response.message });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : '生成失败，请稍后重试';
      replacePending(conversationId, pendingMessage.id, { id: `message-${idCounter.current++}`, role: 'ai', text: errorText, status: 'error' });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar activeId={activeId} conversations={summaries} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onNew={newChat} onSelect={openChat} />
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <button aria-label="打开导航" className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)}><BrandMark s={18} /></button>
            {view === 'chat' && activeConversation ? (
              <>
                <span className={`platform-pill ${platform}`}>
                  {platform === 'xhs' && <XhsMark />}
                  {platform === 'dy' && <DyMark />}
                  {platform === 'amazon' && <AmazonMark />}
                  {PLATFORM_LABELS[platform]}
                </span>
                <span className="topbar-title">{activeConversation.title}</span>
                <button aria-label="查看历史" className="icon-button optional"><IconHistory /></button>
                <button aria-label="分享对话" className="icon-button optional"><IconShare /></button>
              </>
            ) : <span className="topbar-title">开始一段新对话</span>}
            <div className="view-toggle">
              <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>对话</button>
              <button className={view === 'welcome' ? 'active' : ''} onClick={newChat}>新对话</button>
            </div>
          </div>
        </header>

        {view === 'chat' && activeConversation ? (
          <div className="chat-scroll dot-grid" ref={scrollRef}>
            <div className="messages">
              {messages.length === 0 && <div className="empty-chat">这是一个新对话。告诉我商品信息、平台和你想要的内容类型。</div>}
              {messages.map((message) => <ChatBubble key={message.id} msg={message} />)}
            </div>
          </div>
        ) : <WelcomeScreen onSelect={startFromPlatform} />}

        {view === 'chat' && activeConversation && <InputBar onSend={send} onTextChange={setDraft} pending={pending} text={draft} />}
      </main>
    </div>
  );
}

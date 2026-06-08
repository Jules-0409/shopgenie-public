'use client';

import { useEffect, useRef, useState } from 'react';
import ChatBubble, { type Message } from '@/components/ChatBubble';
import { BrandMark, DyMark, IconHistory, IconShare, XhsMark } from '@/components/Icons';
import InputBar from '@/components/InputBar';
import type { XHSNote } from '@/components/ResultCard';
import Sidebar from '@/components/Sidebar';
import WelcomeScreen from '@/components/WelcomeScreen';

const NOTE: XHSNote = {
  plat: 'xhs',
  type: '小红书种草笔记',
  title: '干皮姐妹别划走！敷完这个面膜我室友问我打了水光针 💧',
  body: `姐妹们我真的不夸张，上周换季脸干到起皮，随手买了这个面膜试试，结果——

用了一周的变化：
📍 第1天：敷完觉得脸喝饱了水，但以为是即时效果
📍 第3天：上妆不卡粉了！粉底液都省了
📍 第7天：室友问我是不是偷偷去打了水光针 😂

成分扒了一下：
✅ 3重玻尿酸（大中小分子，补水锁水都有）
✅ 神经酰胺（修护屏障）
✅ 无酒精无香精（敏感肌放心）

精华液超多，敷完还能抹脖子抹手。面膜纸很服帖，不会往下掉。味道淡淡的，没有廉价香精味。

💰 59元一盒 / 5片，活动买二送一，算下来一片不到8块
📌 干皮 / 混干皮闭眼入，油皮夏天可能觉得稍微滋润了点`,
  tags: ['面膜推荐', '补水面膜', '敏感肌护肤', '干皮救星', '平价护肤', '玻尿酸面膜'],
};

const SEED_MESSAGES: Message[] = [
  { id: 1, role: 'user', text: '帮我写个小红书笔记，玻尿酸补水面膜，真实分享风格' },
  { id: 2, role: 'ai', text: '好，给你写了一篇真实分享型的种草笔记。', card: NOTE },
  { id: 3, role: 'user', text: '标题能更抓人一点吗？有没有其他版本？' },
  { id: 4, role: 'ai', text: `当然，给你 3 个备选标题，风格各不同：

① 敷了7天才明白，为什么干皮都在偷偷囤这个面膜
② 脸干到起皮然后我试了这个……结果真的出乎意料
③ 室友以为我去打了水光针，不，就是一个59块的面膜

你更喜欢哪个风格？` },
];

export default function Home() {
  const [activeId, setActiveId] = useState<number | null>(1);
  const [messages, setMessages] = useState(SEED_MESSAGES);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'welcome'>('chat');
  const [platform, setPlatform] = useState<'xhs' | 'dy'>('xhs');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, view]);

  const openChat = (id: number) => {
    setActiveId(id);
    setView('chat');
  };

  const newChat = () => {
    setActiveId(null);
    setView('welcome');
  };

  const send = (text: string) => {
    setView('chat');
    setMessages((current) => [...current, { id: Date.now(), role: 'user', text }]);
  };

  return (
    <div className="app-shell">
      <Sidebar activeId={activeId} mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} onNew={newChat} onSelect={openChat} />
      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-inner">
            <button aria-label="打开导航" className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)}><BrandMark s={18} /></button>
            {view === 'chat' ? (
              <>
                <span className={`platform-pill ${platform === 'dy' ? 'dy' : ''}`}>
                  {platform === 'xhs' ? <XhsMark /> : <DyMark />}
                  {platform === 'xhs' ? '小红书' : '抖音'}
                </span>
                <span className="topbar-title">玻尿酸补水面膜 · 种草笔记</span>
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

        {view === 'chat' ? (
          <div className="chat-scroll dot-grid" ref={scrollRef}>
            <div className="messages">{messages.map((message) => <ChatBubble key={message.id} msg={message} />)}</div>
          </div>
        ) : <WelcomeScreen onAction={() => openChat(1)} />}

        <InputBar onPlat={setPlatform} onSend={send} plat={platform} />
      </main>
    </div>
  );
}

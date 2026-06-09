'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { Message } from '@/components/ChatBubble';
import type { Platform } from '@/lib/platforms';
import { PLATFORM_LABELS } from '@/lib/platforms';
import { sendChat } from '@/lib/api';

interface Conversation {
  id: string;
  title: string;
  platform: Platform;
  messages: Message[];
  productId?: string | null;
}

const STORAGE_KEY = 'shopgenie.conversations.v1';

const titleFromMessage = (text: string, platform: Platform) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean) return clean.length > 18 ? `${clean.slice(0, 18)}…` : clean;
  return `${PLATFORM_LABELS[platform]} 新对话`;
};

const historyContent = (message: Message) => {
  if (!message.card) return message.text;
  return `${message.text}\n\n当前生成内容：${JSON.stringify(message.card)}`.slice(0, 4000);
};

export const DEMO_CONVERSATION: Conversation = {
  id: 'demo-xhs',
  title: '玻尿酸面膜 · 种草笔记',
  platform: 'xhs',
  messages: [
    { id: 'demo-user', role: 'user', text: '帮我写个小红书笔记，玻尿酸补水面膜，真实分享风格', demo: true },
    {
      id: 'demo-ai', role: 'ai', text: '这是演示卡片。真实生成请点"新对话"后输入商品信息。', demo: true,
      card: {
        platform: 'xhs' as const,
        title: '干皮姐妹别划走！敷完这个面膜我室友问我打了水光针 💧',
        body: '这是一个演示样例，用来展示结果卡片长什么样。\n\n真实生成已经接入后端：点击"新对话"，输入你的商品事实，我会基于真实信息生成内容；信息不足时会先追问，不会硬编。',
        tags: ['面膜推荐', '补水面膜', '敏感肌护肤', '干皮救星'],
        sections: [],
      },
    },
  ],
};

export function useChat(defaultProductId: string | null) {
  const [conversations, setConversations] = useState<Conversation[]>([DEMO_CONVERSATION]);
  const [activeId, setActiveId] = useState<string | null>('demo-xhs');
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const idCounter = useRef(1);
  const abortRef = useRef<AbortController | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation]);
  const platform = activeConversation?.platform ?? 'xhs';
  const activeProductId = activeConversation?.productId ?? defaultProductId;

  const hydrate = useCallback(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Conversation[];
        if (Array.isArray(saved) && saved.length > 0) {
          setConversations([...saved, DEMO_CONVERSATION]);
          setActiveId(saved[0].id);
          idCounter.current = saved.reduce((max, c) => {
            const maxId = c.messages.reduce((m, msg) => {
              const num = parseInt(msg.id.replace('message-', ''), 10);
              return isNaN(num) ? m : Math.max(m, num);
            }, 0);
            return Math.max(max, maxId);
          }, 0) + 1;
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setHydrated(true);
  }, []);

  const persist = useCallback(() => {
    if (!hydrated) return;
    const serializable = conversations.filter((c) => c.id !== 'demo-xhs');
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [conversations, hydrated]);

  const appendMessage = useCallback((conversationId: string, message: Message) => {
    setConversations((current) => current.map((c) =>
      c.id === conversationId ? { ...c, messages: [...c.messages, message] } : c,
    ));
  }, []);

  const replacePending = useCallback((conversationId: string, pendingId: string, message: Message) => {
    setConversations((current) => current.map((c) =>
      c.id === conversationId ? { ...c, messages: [...c.messages.filter((m) => m.id !== pendingId), message] } : c,
    ));
  }, []);

  const requestResponse = useCallback(async (
    conversationId: string,
    requestPlatform: Platform,
    text: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    appendUser: boolean,
    productId?: string | null,
  ) => {
    if (pending) return;
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const userMessage: Message = { id: `message-${idCounter.current++}`, role: 'user', text };
    const pendingMessage: Message = { id: `message-${idCounter.current++}`, role: 'ai', text: '', status: 'pending' };
    if (appendUser) appendMessage(conversationId, userMessage);
    appendMessage(conversationId, pendingMessage);
    setConversations((current) => current.map((item) =>
      item.id === conversationId && item.title.endsWith('新对话')
        ? { ...item, title: titleFromMessage(text, requestPlatform) }
        : item,
    ));

    try {
      const response = await sendChat(requestPlatform, text, history, productId ?? undefined, controller.signal);
      replacePending(conversationId, pendingMessage.id, {
        id: `message-${idCounter.current++}`, role: 'ai', text: response.message,
        card: response.result ?? undefined, questions: response.questions ?? undefined,
        warnings: response.warnings ?? undefined, assetId: response.asset_id ?? undefined,
        quality: response.quality ?? undefined, taskId: response.task_id ?? undefined,
        sources: response.sources,
      });
      if (response.conversation_title) {
        setConversations((current) => current.map((item) =>
          item.id === conversationId ? { ...item, title: response.conversation_title! } : item,
        ));
      }
    } catch (error) {
      const errorText = controller.signal.aborted ? '已停止生成' : error instanceof Error ? error.message : '生成失败，请稍后重试';
      replacePending(conversationId, pendingMessage.id, { id: `message-${idCounter.current++}`, role: 'ai', text: errorText, status: 'error' });
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  }, [pending, appendMessage, replacePending]);

  const createConversation = useCallback((platformChoice: Platform, title = `${PLATFORM_LABELS[platformChoice]} 新对话`) => {
    const conversation: Conversation = {
      id: `conversation-${idCounter.current++}`,
      title,
      platform: platformChoice,
      messages: [],
      productId: defaultProductId,
    };
    setConversations((current) => [conversation, ...current]);
    setActiveId(conversation.id);
    return conversation;
  }, [defaultProductId]);

  const send = useCallback(async (text: string) => {
    if (pending) return;
    const conversation = activeConversation ?? createConversation(platform);
    const history = conversation.messages.filter((m) => !m.demo && !m.status).slice(-10).map((m) => ({
      role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: historyContent(m),
    }));
    await requestResponse(conversation.id, conversation.platform, text, history, true, conversation.productId ?? defaultProductId);
  }, [pending, activeConversation, platform, createConversation, requestResponse, defaultProductId]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(() => {
    if (!activeConversation || pending) return;
    const msgs = activeConversation.messages;
    let lastUserIndex = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user' && !msgs[i].demo) { lastUserIndex = i; break; }
    }
    if (lastUserIndex < 0) return;
    const lastUserText = msgs[lastUserIndex].text;
    const history = msgs.slice(0, lastUserIndex).filter((m) => !m.demo && !m.status).slice(-10).map((m) => ({
      role: m.role === 'ai' ? 'assistant' as const : 'user' as const,
      content: historyContent(m),
    }));
    setConversations((current) => current.map((conv) => {
      if (conv.id !== activeConversation.id) return conv;
      return { ...conv, messages: conv.messages.slice(0, lastUserIndex + 1) };
    }));
    void requestResponse(activeConversation.id, activeConversation.platform, lastUserText, history, false, activeConversation.productId ?? defaultProductId);
  }, [activeConversation, pending, requestResponse, defaultProductId]);

  const setActiveProduct = useCallback((productId: string | null) => {
    if (activeConversation) {
      setConversations((current) => current.map((c) =>
        c.id === activeConversation.id ? { ...c, productId } : c,
      ));
    }
  }, [activeConversation]);

  return {
    conversations, setConversations,
    activeId, setActiveId,
    activeConversation, activeProductId,
    messages, platform,
    pending, hydrated,
    hydrate, persist,
    send, stop, regenerate,
    createConversation, setActiveProduct,
  };
}

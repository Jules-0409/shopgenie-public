'use client';

import { createContext, useContext, ReactNode, useEffect } from 'react';
import { useChat } from '@/hooks/useChat';

type ChatContextType = ReturnType<typeof useChat>;

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children, defaultProductId }: { children: ReactNode; defaultProductId: string | null }) {
  const chat = useChat(defaultProductId);

  // Run hydration on mount
  useEffect(() => {
    void chat.hydrate();
  }, [chat.hydrate]);

  // Run persistence when conversations change
  useEffect(() => {
    chat.persist();
  }, [chat.conversations, chat.hydrated, chat.persist]);

  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}

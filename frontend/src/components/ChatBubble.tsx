'use client';

import ResultCard from './ResultCard';
import type { GeneratedContent } from '@/lib/api';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  card?: GeneratedContent;
  demo?: boolean;
  status?: 'pending' | 'error';
}

export default function ChatBubble({ msg }: { msg: Message }) {
  return (
    <div className={`message-row ${msg.role === 'user' ? 'user' : ''}`}>
      <div className="message-column">
        {msg.text && <div className={`bubble ${msg.status ?? ''}`}>{msg.status === 'pending' && <span className="typing-dot" />}{msg.text}</div>}
        {msg.card && <ResultCard card={msg.card} />}
      </div>
    </div>
  );
}

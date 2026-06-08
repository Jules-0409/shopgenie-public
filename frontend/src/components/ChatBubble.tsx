'use client';

import ResultCard, { type XHSNote } from './ResultCard';

export interface Message {
  id: number;
  role: 'user' | 'ai';
  text: string;
  card?: XHSNote;
}

export default function ChatBubble({ msg }: { msg: Message }) {
  return (
    <div className={`message-row ${msg.role === 'user' ? 'user' : ''}`}>
      <div className="message-column">
        <div className="bubble">{msg.text}</div>
        {msg.card && <ResultCard card={msg.card} />}
      </div>
    </div>
  );
}

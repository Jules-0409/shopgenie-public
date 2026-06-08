'use client';

import type { KeyboardEvent } from 'react';
import { IconSend } from './Icons';

interface InputBarProps {
  pending: boolean;
  text: string;
  onSend: (text: string) => void;
  onTextChange: (text: string) => void;
}

export default function InputBar({ pending, text, onSend, onTextChange }: InputBarProps) {
  const submit = () => {
    const value = text.trim();
    if (!value || pending) return;
    onSend(value);
    onTextChange('');
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-area">
      <div className="composer">
        <textarea
          maxLength={500}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="继续和我说，或告诉我新商品信息…"
          rows={2}
          value={text}
        />
        <div className="composer-footer">
          <span>Enter 发送 · Shift + Enter 换行</span>
          <span className="count">{text.length} / 500</span>
          <button aria-label="发送消息" className="send-button" disabled={!text.trim() || pending} onClick={submit}><IconSend /></button>
        </div>
      </div>
    </div>
  );
}

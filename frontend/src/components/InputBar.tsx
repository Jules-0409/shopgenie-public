'use client';

import type { KeyboardEvent } from 'react';
import { IconSend } from './Icons';

interface InputBarProps {
  pending: boolean;
  text: string;
  onSend: (text: string) => void;
  onTextChange: (text: string) => void;
  onStop?: () => void;
}

export default function InputBar({ pending, text, onSend, onTextChange, onStop }: InputBarProps) {
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
          {pending ? (
            <button aria-label="停止生成" className="send-button stop-button" onClick={onStop}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="2" /></svg>
            </button>
          ) : (
            <button aria-label="发送消息" className="send-button" disabled={!text.trim()} onClick={submit}><IconSend /></button>
          )}
        </div>
      </div>
    </div>
  );
}

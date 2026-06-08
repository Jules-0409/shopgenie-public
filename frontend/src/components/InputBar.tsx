'use client';

import { useState, type KeyboardEvent } from 'react';
import { AmazonMark, DyMark, IconSend, XhsMark } from './Icons';
import type { Platform } from '@/lib/platforms';

interface InputBarProps {
  plat: Platform;
  pending: boolean;
  onPlat: (platform: Platform) => void;
  onSend: (text: string) => void;
}

export default function InputBar({ plat, pending, onPlat, onSend }: InputBarProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value || pending) return;
    onSend(value);
    setText('');
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
        <div className="composer-top">
          <button className={`platform-tab ${plat === 'xhs' ? 'active-xhs' : ''}`} onClick={() => onPlat('xhs')}><XhsMark /> 小红书</button>
          <button className={`platform-tab ${plat === 'dy' ? 'active-dy' : ''}`} onClick={() => onPlat('dy')}><DyMark /> 抖音</button>
          <button className={`platform-tab ${plat === 'amazon' ? 'active-amazon' : ''}`} onClick={() => onPlat('amazon')}><AmazonMark /> Amazon</button>
        </div>
        <textarea
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
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

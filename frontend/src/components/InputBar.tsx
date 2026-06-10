'use client';

import type { ChangeEvent, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { IconSend } from './Icons';
import { toast } from '@/lib/toast';

interface InputBarProps {
  pending: boolean;
  text: string;
  onSend: (text: string, imageUrl?: string) => void;
  onTextChange: (text: string) => void;
  onStop?: () => void;
}

export default function InputBar({ pending, text, onSend, onTextChange, onStop }: InputBarProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const value = text.trim();
    if (!value && !imagePreview) return;
    if (pending) return;
    onSend(value || '请分析这张图片', imagePreview ?? undefined);
    onTextChange('');
    setImagePreview(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || (!event.shiftKey && !event.metaKey && !event.ctrlKey))) {
      event.preventDefault();
      submit();
    }
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      // 与后端 base64 上限（5,000,000 字符）一致：按编码后实际长度校验
      if (data.length > 5_000_000) {
        toast('图片编码后超过限制，请压缩到约 3.5MB 以内');
        return;
      }
      setImagePreview(data);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="composer-area">
      <div className="composer">
        {imagePreview && (
          <div className="image-preview-bar">
            <img src={imagePreview} alt="待发送图片" />
            <button className="image-preview-remove" onClick={() => setImagePreview(null)}>×</button>
          </div>
        )}
        <textarea
          maxLength={500}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={imagePreview ? '描述一下你想让 AI 做什么（可选）…' : '继续和我说，或告诉我新商品信息…'}
          rows={2}
          value={text}
        />
        <div className="composer-footer">
          <div className="composer-actions">
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageSelect} />
            <button aria-label="上传图片" className="icon-button-sm" onClick={() => fileRef.current?.click()} title="上传图片">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
            </button>
          </div>
          <span>Enter 发送 · Shift + Enter 换行</span>
          <span className="count">{text.length} / 500</span>
          {pending ? (
            <button aria-label="停止生成" className="send-button stop-button" onClick={onStop}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="2" width="10" height="10" rx="2" /></svg>
            </button>
          ) : (
            <button aria-label="发送消息" className="send-button" disabled={!text.trim() && !imagePreview} onClick={submit}><IconSend /></button>
          )}
        </div>
      </div>
    </div>
  );
}

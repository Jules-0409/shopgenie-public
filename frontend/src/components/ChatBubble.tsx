'use client';

import { useState } from 'react';
import ResultCard from './ResultCard';
import type { GeneratedContent, QualityReport } from '@/lib/api';

export interface Question {
  question: string;
  options: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  image?: string;
  card?: GeneratedContent;
  questions?: Question[];
  warnings?: string[];
  demo?: boolean;
  status?: 'pending' | 'error';
  assetId?: string;
  quality?: QualityReport;
  taskId?: string;
  sources?: { id: string; title: string; url: string }[];
}

function renderText(text: string) {
  const parts = text.split(/(\[待补充[^\]]*\])/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (part.startsWith('[待补充')) {
      const label = part.slice(4, -1) || '请补充';
      return <span key={index} className="placeholder-badge">{label}</span>;
    }
    return part;
  });
}

function WarningBanner({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <div className="warning-banner">
      <div className="warning-header">⚠️ 内容检查提醒</div>
      {warnings.map((w, i) => <div key={i} className="warning-item">{w}</div>)}
    </div>
  );
}

function QuestionChips({ questions, onSubmit }: { questions: Question[]; onSubmit: (text: string) => void }) {
  const [selections, setSelections] = useState<Record<number, string[]>>({});
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({});

  const toggle = (questionIndex: number, option: string) => {
    setSelections((prev) => {
      const current = prev[questionIndex] ?? [];
      const exists = current.includes(option);
      return { ...prev, [questionIndex]: exists ? current.filter((o) => o !== option) : [...current, option] };
    });
  };

  const hasSelections = Object.values(selections).some((s) => s.length > 0) || Object.values(customInputs).some((s) => s.trim());

  const submit = () => {
    const parts: string[] = [];
    questions.forEach((q, index) => {
      const selected = selections[index] ?? [];
      const custom = customInputs[index]?.trim();
      if (selected.length > 0 || custom) {
        const answers = [...selected];
        if (custom) answers.push(custom);
        parts.push(`${q.question}：${answers.join('、')}`);
      }
    });
    if (parts.length > 0) onSubmit(parts.join('\n'));
  };

  return (
    <div className="question-chips">
      {questions.map((q, index) => (
        <div key={index} className="question-group">
          <div className="question-label">{q.question}</div>
          <div className="question-options">
            {q.options.filter((option) => !option.includes('自定义')).map((option, optionIndex) => {
              const selected = (selections[index] ?? []).includes(option);
              return (
                <button
                  key={optionIndex}
                  className={`question-option${selected ? ' selected' : ''}`}
                  onClick={() => toggle(index, option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
          <input
            className="question-custom-input"
            placeholder="自定义填写…"
            value={customInputs[index] ?? ''}
            onChange={(e) => setCustomInputs((prev) => ({ ...prev, [index]: e.target.value }))}
          />
        </div>
      ))}
      <button className="question-submit" disabled={!hasSelections} onClick={submit}>
        确认选择
      </button>
    </div>
  );
}

export default function ChatBubble({ msg, onOptionSelect, onRegenerate, brandName, onEditAsset }: {
  msg: Message;
  onOptionSelect?: (text: string) => void;
  onRegenerate?: () => void;
  brandName?: string;
  onEditAsset?: (assetId: string) => void;
}) {
  return (
    <div className={`message-row ${msg.role === 'user' ? 'user' : ''}`}>
      <div className="message-column">
        {msg.text && <div className={`bubble ${msg.status ?? ''}`}>{msg.status === 'pending' && <span className="typing-dot" />}{renderText(msg.text)}</div>}
        {!msg.text && msg.status === 'pending' && (
          <div className="bubble pending typing-indicator">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}
        {msg.warnings && msg.warnings.length > 0 && <WarningBanner warnings={msg.warnings} />}
        {msg.card && <ResultCard card={msg.card} brandName={brandName} onRegenerate={onRegenerate} quality={msg.quality} warnings={msg.warnings} onEdit={msg.assetId && onEditAsset ? () => onEditAsset(msg.assetId!) : undefined} />}
        {msg.questions && msg.questions.length > 0 && onOptionSelect && (
          <QuestionChips questions={msg.questions} onSubmit={onOptionSelect} />
        )}
        {msg.sources && msg.sources.length > 0 && <div className="source-list"><strong>参考来源</strong>{msg.sources.map((source) => source.url ? <a href={source.url} key={source.id} rel="noreferrer" target="_blank">{source.title}</a> : <span key={source.id}>{source.title}</span>)}</div>}
        {msg.role === 'ai' && !msg.card && !msg.status && !msg.demo && onRegenerate && (
          <button className="regenerate-button" onClick={onRegenerate}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            重新生成
          </button>
        )}
      </div>
    </div>
  );
}

'use client';

import ResultCard from './ResultCard';
import type { GeneratedContent } from '@/lib/api';

export interface Question {
  question: string;
  options: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  card?: GeneratedContent;
  questions?: Question[];
  demo?: boolean;
  status?: 'pending' | 'error';
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

function QuestionChips({ questions, onSelect }: { questions: Question[]; onSelect: (text: string) => void }) {
  return (
    <div className="question-chips">
      {questions.map((q, index) => (
        <div key={index} className="question-group">
          <div className="question-label">{q.question}</div>
          <div className="question-options">
            {q.options.map((option, optionIndex) => (
              <button key={optionIndex} className="question-option" onClick={() => onSelect(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ChatBubble({ msg, onOptionSelect, onRegenerate }: {
  msg: Message;
  onOptionSelect?: (text: string) => void;
  onRegenerate?: () => void;
}) {
  return (
    <div className={`message-row ${msg.role === 'user' ? 'user' : ''}`}>
      <div className="message-column">
        {msg.text && <div className={`bubble ${msg.status ?? ''}`}>{msg.status === 'pending' && <span className="typing-dot" />}{renderText(msg.text)}</div>}
        {msg.card && <ResultCard card={msg.card} />}
        {msg.questions && msg.questions.length > 0 && onOptionSelect && (
          <QuestionChips questions={msg.questions} onSelect={onOptionSelect} />
        )}
        {msg.role === 'ai' && !msg.status && !msg.demo && onRegenerate && (
          <button className="regenerate-button" onClick={onRegenerate}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
            重新生成
          </button>
        )}
      </div>
    </div>
  );
}

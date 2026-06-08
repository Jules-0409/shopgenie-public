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

export default function ChatBubble({ msg, onOptionSelect }: { msg: Message; onOptionSelect?: (text: string) => void }) {
  return (
    <div className={`message-row ${msg.role === 'user' ? 'user' : ''}`}>
      <div className="message-column">
        {msg.text && <div className={`bubble ${msg.status ?? ''}`}>{msg.status === 'pending' && <span className="typing-dot" />}{renderText(msg.text)}</div>}
        {msg.card && <ResultCard card={msg.card} />}
        {msg.questions && msg.questions.length > 0 && onOptionSelect && (
          <QuestionChips questions={msg.questions} onSelect={onOptionSelect} />
        )}
      </div>
    </div>
  );
}

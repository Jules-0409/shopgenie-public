'use client';

import { useState } from 'react';
import type { GeneratedContent } from '@/lib/api';

function diffWords(oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; text: string }[] {
  if (oldText === newText) return [{ type: 'same', text: oldText }];
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const result: { type: 'same' | 'added' | 'removed'; text: string }[] = [];

  // Simple LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldWords[i - 1] === newWords[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const ops: { type: 'same' | 'added' | 'removed'; text: string }[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      ops.unshift({ type: 'same', text: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'added', text: newWords[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'removed', text: oldWords[i - 1] });
      i--;
    }
  }

  // Merge consecutive same-type ops
  for (const op of ops) {
    if (result.length > 0 && result[result.length - 1].type === op.type) {
      result[result.length - 1].text += op.text;
    } else {
      result.push({ ...op });
    }
  }
  return result;
}

function DiffLine({ parts }: { parts: { type: 'same' | 'added' | 'removed'; text: string }[] }) {
  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'added') return <span key={i} className="diff-added">{part.text}</span>;
        if (part.type === 'removed') return <span key={i} className="diff-removed">{part.text}</span>;
        return <span key={i}>{part.text}</span>;
      })}
    </span>
  );
}

export default function VersionDiff({ oldContent, newContent, oldVersion, newVersion }: {
  oldContent: GeneratedContent;
  newContent: GeneratedContent;
  oldVersion: number;
  newVersion: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const titleDiff = diffWords(oldContent.title, newContent.title);
  const bodyDiff = diffWords(oldContent.body, newContent.body);
  const hasTitleChange = oldContent.title !== newContent.title;
  const hasBodyChange = oldContent.body !== newContent.body;

  if (!hasTitleChange && !hasBodyChange) {
    return <div className="version-diff-empty">两个版本内容相同</div>;
  }

  return (
    <div className="version-diff">
      <button className="version-diff-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? '收起对比' : `对比 v${oldVersion} → v${newVersion}`}
      </button>
      {expanded && (
        <div className="version-diff-content">
          {hasTitleChange && (
            <div className="diff-section">
              <div className="diff-label">标题</div>
              <div className="diff-line"><DiffLine parts={titleDiff} /></div>
            </div>
          )}
          {hasBodyChange && (
            <div className="diff-section">
              <div className="diff-label">正文</div>
              <div className="diff-line diff-body"><DiffLine parts={bodyDiff} /></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VersionDiff from '@/components/VersionDiff';
import type { GeneratedContent } from '@/lib/api';

const base: GeneratedContent = {
  platform: 'xhs', title: '原始标题', body: '原始正文内容', tags: [], sections: [],
};

describe('VersionDiff', () => {
  it('shows same-version message when content is identical (no toggle)', () => {
    render(
      <VersionDiff oldContent={base} newContent={base} oldVersion={1} newVersion={2} />,
    );
    expect(screen.getByText('两个版本内容相同')).toBeInTheDocument();
    expect(screen.queryByText('对比 v1 → v2')).not.toBeInTheDocument();
  });

  it('shows toggle button when content differs', () => {
    const updated = { ...base, title: '新标题' };
    render(
      <VersionDiff oldContent={base} newContent={updated} oldVersion={1} newVersion={2} />,
    );
    expect(screen.getByText('对比 v1 → v2')).toBeInTheDocument();
  });

  it('shows diff sections when expanded', () => {
    const updated = { ...base, title: '新标题', body: '新正文内容' };
    render(
      <VersionDiff oldContent={base} newContent={updated} oldVersion={1} newVersion={2} />,
    );
    fireEvent.click(screen.getByText('对比 v1 → v2'));
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('正文')).toBeInTheDocument();
  });

  it('toggles expand/collapse', () => {
    const updated = { ...base, title: '新标题' };
    render(
      <VersionDiff oldContent={base} newContent={updated} oldVersion={1} newVersion={2} />,
    );
    const toggle = screen.getByText('对比 v1 → v2');
    fireEvent.click(toggle);
    expect(screen.getByText('收起对比')).toBeInTheDocument();
    fireEvent.click(screen.getByText('收起对比'));
    expect(screen.getByText('对比 v1 → v2')).toBeInTheDocument();
  });
});

import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ChatBubble from '@/components/ChatBubble';
import type { GeneratedContent } from '@/lib/api';

const mockCard: GeneratedContent = {
  platform: 'xhs', title: '测试标题', body: '测试正文', tags: ['测试标签'], sections: [],
};

describe('ChatBubble', () => {
  it('renders user message', () => {
    render(<ChatBubble msg={{ id: '1', role: 'user', text: '用户消息' }} />);
    expect(screen.getByText('用户消息')).toBeInTheDocument();
  });

  it('renders ai message', () => {
    render(<ChatBubble msg={{ id: '2', role: 'ai', text: 'AI回复' }} />);
    expect(screen.getByText('AI回复')).toBeInTheDocument();
  });

  it('renders pending indicator with status text', () => {
    render(<ChatBubble msg={{ id: '3', role: 'ai', text: '正在生成...', status: 'pending' }} />);
    expect(screen.getByText('正在生成...')).toBeInTheDocument();
  });

  it('renders empty pending as typing dots', () => {
    const { container } = render(<ChatBubble msg={{ id: '4', role: 'ai', text: '', status: 'pending' }} />);
    expect(container.querySelector('.typing-indicator')).toBeInTheDocument();
  });

  it('renders error status', () => {
    render(<ChatBubble msg={{ id: '5', role: 'ai', text: '出错了', status: 'error' }} />);
    expect(screen.getByText('出错了')).toBeInTheDocument();
  });

  it('renders result card when card is present', () => {
    render(<ChatBubble msg={{ id: '6', role: 'ai', text: '生成完成', card: mockCard }} />);
    expect(screen.getByText('测试标题')).toBeInTheDocument();
  });

  it('renders warnings when present', () => {
    render(<ChatBubble msg={{ id: '7', role: 'ai', text: '内容', warnings: ['违禁词警告'] }} />);
    expect(screen.getByText((content) => content.includes('内容检查提醒'))).toBeInTheDocument();
    expect(screen.getByText('违禁词警告')).toBeInTheDocument();
  });

  it('renders regenerate button for last ai message when callback provided', () => {
    render(<ChatBubble msg={{ id: '8', role: 'ai', text: '回复' }} onRegenerate={() => undefined} />);
    expect(screen.getByText('重新生成')).toBeInTheDocument();
  });

  it('does not render regenerate button for user messages', () => {
    render(<ChatBubble msg={{ id: '9', role: 'user', text: '消息' }} onRegenerate={() => undefined} />);
    expect(screen.queryByText('重新生成')).not.toBeInTheDocument();
  });

  it('renders placeholder badges for [待补充] markers', () => {
    const { container } = render(<ChatBubble msg={{ id: '10', role: 'ai', text: '这个产品[待补充:品牌名]很好用' }} />);
    expect(container.querySelector('.placeholder-badge')).toBeInTheDocument();
  });

  it('requires an answer for every follow-up question before submitting', () => {
    const onSubmit = vi.fn();
    render(<ChatBubble msg={{
      id: '11',
      role: 'ai',
      text: '请补充信息',
      questions: [
        { question: '防水等级？', options: ['IP67', '不防水'] },
        { question: '电池容量？', options: ['600mAh', '800mAh'] },
      ],
    }} onOptionSelect={onSubmit} />);

    const incomplete = screen.getByRole('button', { name: '请完成全部问题（0/2）' });
    expect(incomplete).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '600mAh' }));
    expect(screen.getByRole('button', { name: '请完成全部问题（1/2）' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'IP67' }));
    fireEvent.click(screen.getByRole('button', { name: '确认选择' }));

    expect(onSubmit).toHaveBeenCalledWith('防水等级？：IP67\n电池容量？：600mAh');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import InputBar from '@/components/InputBar';

describe('InputBar', () => {
  it('renders textarea and send button', () => {
    render(<InputBar pending={false} text="" onSend={() => undefined} onTextChange={() => undefined} />);
    expect(screen.getByPlaceholderText('继续和我说，或告诉我新商品信息…')).toBeInTheDocument();
    expect(screen.getByLabelText('发送消息')).toBeInTheDocument();
  });

  it('disables send button when text is empty', () => {
    render(<InputBar pending={false} text="" onSend={() => undefined} onTextChange={() => undefined} />);
    expect(screen.getByLabelText('发送消息')).toBeDisabled();
  });

  it('enables send button when text is present', () => {
    render(<InputBar pending={false} text="hello" onSend={() => undefined} onTextChange={() => undefined} />);
    expect(screen.getByLabelText('发送消息')).not.toBeDisabled();
  });

  it('shows stop button when pending', () => {
    render(<InputBar pending={true} text="" onSend={() => undefined} onTextChange={() => undefined} onStop={() => undefined} />);
    expect(screen.getByLabelText('停止生成')).toBeInTheDocument();
    expect(screen.queryByLabelText('发送消息')).not.toBeInTheDocument();
  });

  it('calls onSend when send button clicked', () => {
    const onSend = vi.fn();
    render(<InputBar pending={false} text="test message" onSend={onSend} onTextChange={() => undefined} />);
    fireEvent.click(screen.getByLabelText('发送消息'));
    expect(onSend).toHaveBeenCalledWith('test message', undefined);
  });

  it('calls onStop when stop button clicked', () => {
    const onStop = vi.fn();
    render(<InputBar pending={true} text="" onSend={() => undefined} onTextChange={() => undefined} onStop={onStop} />);
    fireEvent.click(screen.getByLabelText('停止生成'));
    expect(onStop).toHaveBeenCalled();
  });

  it('shows character count', () => {
    render(<InputBar pending={false} text="hello" onSend={() => undefined} onTextChange={() => undefined} />);
    expect(screen.getByText('5 / 500')).toBeInTheDocument();
  });
});

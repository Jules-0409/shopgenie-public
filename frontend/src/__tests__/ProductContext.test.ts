import { describe, expect, it } from 'vitest';
import { isProductContextLocked, type Conversation } from '@/hooks/useChat';

const conversation = (messages: Conversation['messages']): Conversation => ({
  id: 'conversation-1',
  title: '测试会话',
  platform: 'xhs',
  messages,
  productId: 'product-a',
});

describe('product context lock', () => {
  it('allows product selection before the first real message', () => {
    expect(isProductContextLocked(null)).toBe(false);
    expect(isProductContextLocked(conversation([]))).toBe(false);
    expect(isProductContextLocked(conversation([{ id: 'demo', role: 'user', text: '演示', demo: true }]))).toBe(false);
  });

  it('locks the product after any real conversation message', () => {
    expect(isProductContextLocked(conversation([{ id: 'real', role: 'user', text: '为商品 A 写内容' }]))).toBe(true);
  });
});

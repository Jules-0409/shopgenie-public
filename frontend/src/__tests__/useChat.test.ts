import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChat } from '@/hooks/useChat';
import { listStoredSessions, saveStoredSession } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  deleteStoredSession: vi.fn().mockResolvedValue({ deleted: true }),
  listStoredSessions: vi.fn(),
  saveStoredSession: vi.fn().mockResolvedValue({}),
  sendChatStream: vi.fn(),
}));

describe('useChat persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: vi.fn(), removeItem: vi.fn(), setItem: vi.fn() },
    });
  });

  it('does not write every restored session back during page load', async () => {
    vi.mocked(listStoredSessions).mockResolvedValue([{
      id: 'session-1',
      platform: 'dy',
      title: '抖音脚本',
      product_id: null,
      product_binding_confirmed: false,
      messages: [],
      created_at: '2026-06-15T00:00:00Z',
      updated_at: '2026-06-15T00:00:00Z',
    }]);

    const { result } = renderHook(() => useChat(null));
    await act(async () => {
      await result.current.hydrate();
    });
    act(() => {
      result.current.persist();
      vi.advanceTimersByTime(1600);
    });

    expect(saveStoredSession).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OperationsHub } from '@/components/WelcomeScreen';

vi.mock('@/lib/api', () => ({
  listProducts: vi.fn().mockResolvedValue([]),
  listExperiments: vi.fn().mockResolvedValue([]),
  getPerformanceInsights: vi.fn().mockResolvedValue({
    records: 0, impressions: 0, conversions: 0, conversion_rate: 0, summary: '',
  }),
  getOperationsBrief: vi.fn().mockResolvedValue({
    status: 'attention',
    summary: '今天建议优先处理 1 件事，其中 1 件需要尽快关注。',
    actions: [{
      id: 'record-first-performance',
      priority: 'high',
      title: '回填第一条内容的发布效果',
      reason: '已有内容资产，但还没有效果数据。',
      metric: '1 条内容待回流',
      target_tab: 'performance',
      product_id: null,
      asset_id: 'content_1',
    }],
  }),
}));

describe('OperationsHub', () => {
  it('shows daily actions and opens the target workspace tab', async () => {
    const onOpen = vi.fn();
    render(<OperationsHub onOpen={onOpen} />);

    await waitFor(() => expect(screen.getByText('回填第一条内容的发布效果')).toBeInTheDocument());
    expect(screen.getByText('需要关注')).toBeInTheDocument();
    fireEvent.click(screen.getByText('回填第一条内容的发布效果'));

    expect(onOpen).toHaveBeenCalledWith('performance');
  });
});

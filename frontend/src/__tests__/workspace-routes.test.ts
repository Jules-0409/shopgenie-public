import { describe, expect, it } from 'vitest';
import { workspaceHref } from '@/lib/workspace-routes';
import { swrFetcher } from '@/lib/swr-fetcher';
import { vi } from 'vitest';
import { listExperiments } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  listProducts: vi.fn(),
  listExperiments: vi.fn().mockResolvedValue([]),
  listContentAssets: vi.fn(),
  getPerformanceInsights: vi.fn(),
  getOperationsBrief: vi.fn(),
  getMarketingCalendar: vi.fn(),
}));

describe('workspaceHref', () => {
  it('builds stable first-level routes with deep-link parameters', () => {
    expect(workspaceHref('content', { asset_id: 'content_1', product_id: 'product_1' }))
      .toBe('/content?product_id=product_1&asset_id=content_1');
  });

  it('routes every workspace tab to a first-level page', () => {
    expect(workspaceHref('knowledge')).toBe('/knowledge');
    expect(workspaceHref('tasks')).toBe('/tasks');
    expect(workspaceHref('calendar')).toBe('/calendar');
  });

  it('does not treat the SWR cache key as an experiment product id', async () => {
    await expect(swrFetcher.experiments()).resolves.toEqual([]);
    expect(listExperiments).toHaveBeenCalledWith();
  });
});

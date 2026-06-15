import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlatformConnectorPanel } from '@/components/WorkspacePanel';

const { listPlatformConnectors, syncPlatformConnector } = vi.hoisted(() => ({
  listPlatformConnectors: vi.fn().mockResolvedValue([
    { platform: 'xhs', configured: false, mode: 'read_only' },
    { platform: 'dy', configured: true, mode: 'read_only' },
    { platform: 'amazon', configured: false, mode: 'read_only' },
  ]),
  syncPlatformConnector: vi.fn().mockResolvedValue({ platform: 'dy', imported: 2, records: [] }),
}));

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, listPlatformConnectors, syncPlatformConnector };
});

describe('PlatformConnectorPanel', () => {
  it('only enables configured read-only connectors and syncs explicitly', async () => {
    const onSynced = vi.fn().mockResolvedValue(undefined);
    render(<PlatformConnectorPanel onSynced={onSynced} />);

    await waitFor(() => expect(screen.getByText('已配置 · 只读')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: '立即同步' });
    expect(buttons.filter((button) => !button.hasAttribute('disabled'))).toHaveLength(1);
    fireEvent.click(buttons.find((button) => !button.hasAttribute('disabled'))!);

    await waitFor(() => expect(syncPlatformConnector).toHaveBeenCalledWith('dy'));
    expect(onSynced).toHaveBeenCalled();
  });
});

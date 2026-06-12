import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PerformanceCsvImport from '@/components/PerformanceCsvImport';

const previewPerformanceCsv = vi.fn();
const importPerformanceCsv = vi.fn();

vi.mock('@/lib/api', () => ({
  previewPerformanceCsv: (...args: unknown[]) => previewPerformanceCsv(...args),
  importPerformanceCsv: (...args: unknown[]) => importPerformanceCsv(...args),
}));
vi.mock('@/lib/toast', () => ({ toast: vi.fn() }));

describe('PerformanceCsvImport', () => {
  it('requires preview before importing', async () => {
    previewPerformanceCsv.mockResolvedValue({ valid: true, rows: 1, preview: [] });
    importPerformanceCsv.mockResolvedValue({ imported: 1 });
    const onImported = vi.fn().mockResolvedValue(undefined);
    render(<PerformanceCsvImport assets={[]} onImported={onImported} />);

    expect(screen.getByRole('button', { name: '确认导入' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('CSV 内容'), { target: { value: 'asset_id,impressions\ncontent_1,100' } });
    fireEvent.click(screen.getByRole('button', { name: '预览校验' }));
    await waitFor(() => expect(screen.getByText('校验通过：1 行')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '确认导入' }));
    await waitFor(() => expect(importPerformanceCsv).toHaveBeenCalled());
    expect(onImported).toHaveBeenCalled();
  });
});

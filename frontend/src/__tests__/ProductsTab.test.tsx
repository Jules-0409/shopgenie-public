import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProductsTab } from '@/components/WorkspacePanel';

const createProduct = vi.fn();
const updateProduct = vi.fn();

vi.mock('@/lib/api', () => ({
  createProduct: (...args: unknown[]) => createProduct(...args),
  updateProduct: (...args: unknown[]) => updateProduct(...args),
}));
vi.mock('@/lib/toast', () => ({ toast: vi.fn() }));

const product = {
  id: 'product_1',
  name: '轻量保温杯',
  category: '家居',
  audience: '通勤人群',
  selling_points: ['轻量'],
  facts: ['容量 500ml'],
  prohibited_claims: ['永不漏水'],
  notes: '秋冬主推',
  review_insights: null,
  created_at: '2026-06-11T00:00:00Z',
  updated_at: '2026-06-11T00:00:00Z',
};

describe('ProductsTab', () => {
  it('shows selected product details and only opens create form explicitly', async () => {
    const onSelect = vi.fn();
    render(<ProductsTab products={[product]} activeProductId={null} onSelect={onSelect} onCreated={vi.fn().mockResolvedValue(undefined)} />);

    expect(screen.getByText('选择一个商品查看详情')).toBeInTheDocument();
    expect(screen.queryByText('新建商品事实卡')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /轻量保温杯/ }));
    expect(screen.getByDisplayValue('容量 500ml')).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith('product_1');

    fireEvent.click(screen.getByRole('button', { name: '+ 新建商品' }));
    expect(screen.getByText('新建商品事实卡')).toBeInTheDocument();
  });

  it('saves edits through the update contract', async () => {
    updateProduct.mockResolvedValue({ ...product, category: '杯具' });
    render(<ProductsTab products={[product]} activeProductId="product_1" onSelect={vi.fn()} onCreated={vi.fn().mockResolvedValue(undefined)} />);

    fireEvent.change(screen.getByLabelText('品类'), { target: { value: '杯具' } });
    fireEvent.click(screen.getByRole('button', { name: '保存商品详情' }));

    await waitFor(() => expect(updateProduct).toHaveBeenCalledWith('product_1', expect.objectContaining({ category: '杯具' })));
  });
});

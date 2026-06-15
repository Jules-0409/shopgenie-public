import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceTabs, { workspaceTabNeeds } from '@/components/WorkspaceTabs';

describe('WorkspaceTabs', () => {
  it('marks and reveals the active first-level route', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(<WorkspaceTabs activeTab="performance" onSelect={() => undefined} />);

    expect(screen.getByRole('button', { name: '效果数据' })).toHaveAttribute('aria-current', 'page');
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'center' });
  });

  it('notifies the parent when switching modules', () => {
    const onSelect = vi.fn();
    render(<WorkspaceTabs activeTab="products" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: '营销日历' }));

    expect(onSelect).toHaveBeenCalledWith('calendar');
  });

  it('only loads data needed by the active module', () => {
    expect(workspaceTabNeeds('performance')).toEqual({
      products: false,
      assets: true,
      knowledge: false,
      tasks: false,
      performance: true,
      experiments: false,
      calendar: false,
    });
    expect(workspaceTabNeeds('content')).toMatchObject({ products: true, assets: true, performance: false });
  });
});

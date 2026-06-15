import type { WorkspaceTab } from '@/components/WorkspacePanel';
import type { Platform } from './platforms';

export const WORKSPACE_ROUTES: Record<WorkspaceTab, string> = {
  products: '/products',
  content: '/content',
  experiments: '/experiments',
  knowledge: '/knowledge',
  tasks: '/tasks',
  performance: '/performance',
  calendar: '/calendar',
};

export interface WorkspaceRouteParams {
  product_id?: string | null;
  asset_id?: string | null;
  platform?: Platform | null;
  brief?: string | null;
}

export function workspaceHref(tab: WorkspaceTab, params: WorkspaceRouteParams = {}): string {
  const query = new URLSearchParams();
  if (params.product_id) query.set('product_id', params.product_id);
  if (params.asset_id) query.set('asset_id', params.asset_id);
  if (params.platform) query.set('platform', params.platform);
  if (params.brief) query.set('brief', params.brief);
  return `${WORKSPACE_ROUTES[tab]}${query.size ? `?${query.toString()}` : ''}`;
}

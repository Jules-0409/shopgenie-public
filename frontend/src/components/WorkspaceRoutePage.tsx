'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import WorkspacePanel, { type WorkspaceTab } from './WorkspacePanel';
import { useChatContext } from '@/context/ChatContext';
import { isProductContextLocked } from '@/hooks/useChat';
import type { Platform } from '@/lib/platforms';
import { workspaceHref } from '@/lib/workspace-routes';

function RouteWorkspace({ tab }: { tab: WorkspaceTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const chat = useChatContext();
  const params = {
    product_id: searchParams.get('product_id'),
    asset_id: searchParams.get('asset_id'),
    platform: searchParams.get('platform') as Platform | null,
    brief: searchParams.get('brief'),
  };
  const navigateTab = (nextTab: WorkspaceTab) => {
    router.push(workspaceHref(nextTab, params));
  };
  return (
    <WorkspacePanel
      open
      presentation="page"
      initialTab={tab}
      targetAssetId={params.asset_id}
      prefillParams={params}
      activeProductId={chat.activeProductId}
      productContextLocked={isProductContextLocked(chat.activeConversation)}
      onActiveProductChange={chat.setActiveProduct}
      onClose={() => router.push('/')}
      onTabChange={navigateTab}
      onCreateFromTopic={(platform, brief, productId) => {
        const query = new URLSearchParams({ platform, brief });
        if (productId) query.set('product_id', productId);
        router.push(`/?${query.toString()}`);
      }}
    />
  );
}

export default function WorkspaceRoutePage({ tab }: { tab: WorkspaceTab }) {
  return <Suspense fallback={<div className="workspace-route-shell" />}><RouteWorkspace tab={tab} /></Suspense>;
}

'use client';

import { useEffect, useRef } from 'react';
import type { WorkspaceTab } from './WorkspacePanel';

export const WORKSPACE_TAB_META: ReadonlyArray<{
  value: WorkspaceTab;
  label: string;
  description: string;
}> = [
  { value: 'products', label: '商品库', description: '管理商品事实、卖点、禁用声明和评论洞察。' },
  { value: 'content', label: '内容资产', description: '查看、编辑和迭代已经生成的内容版本。' },
  { value: 'experiments', label: 'A/B 实验', description: '生成内容变体并用真实效果数据选出赢家。' },
  { value: 'knowledge', label: '知识来源', description: '管理生成时可引用的平台规则与公开知识。' },
  { value: 'tasks', label: 'Agent 任务', description: '运行并追踪围绕内容资产的运营任务。' },
  { value: 'performance', label: '效果数据', description: '录入或同步发布效果，诊断点击、转化与退款信号。' },
  { value: 'calendar', label: '营销日历', description: '围绕营销节点安排选题、内容与发布计划。' },
];

export function workspaceTabMeta(tab: WorkspaceTab) {
  return WORKSPACE_TAB_META.find((item) => item.value === tab) ?? WORKSPACE_TAB_META[0];
}

export function workspaceTabNeeds(tab: WorkspaceTab) {
  return {
    products: tab === 'products' || tab === 'content' || tab === 'experiments',
    assets: tab === 'content' || tab === 'tasks' || tab === 'performance',
    knowledge: tab === 'knowledge',
    tasks: tab === 'tasks',
    performance: tab === 'performance',
    experiments: tab === 'experiments',
    calendar: tab === 'calendar',
  };
}

export default function WorkspaceTabs({ activeTab, onSelect }: {
  activeTab: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
}) {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeTab]);

  return (
    <nav className="workspace-tabs" aria-label="内容工作台模块">
      {WORKSPACE_TAB_META.map(({ value, label }) => (
        <button
          aria-current={activeTab === value ? 'page' : undefined}
          className={activeTab === value ? 'active' : ''}
          key={value}
          onClick={() => onSelect(value)}
          ref={activeTab === value ? activeRef : undefined}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export type Platform = 'xhs' | 'dy' | 'amazon' | 'cs' | 'design';

export const PLATFORM_LABELS: Record<Platform, string> = {
  xhs: '小红书',
  dy: '抖音',
  amazon: 'Amazon',
  cs: '客服话术',
  design: '设计助手',
};

export const PLATFORM_TITLES: Record<Platform, string> = {
  xhs: '玻尿酸补水面膜 · 种草笔记',
  dy: '玻尿酸补水面膜 · 短视频脚本',
  amazon: '玻尿酸补水面膜 · 商品 Listing',
  cs: '客服话术模板',
  design: '设计助手',
};

export const CONTENT_PLATFORMS: Platform[] = ['xhs', 'dy', 'amazon'];
export const SCENARIO_PLATFORMS: Platform[] = ['cs', 'design'];

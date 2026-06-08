'use client';

const ACTIONS = [
  { number: '01', title: '写抖音短视频脚本', sub: '15–60 秒，包含 Hook、卖点和转化引导' },
  { number: '02', title: '写小红书种草笔记', sub: '一篇可直接发布的标题、正文与标签' },
  { number: '03', title: '写商品文案', sub: '把商品卖点整理成有说服力的详情文案' },
  { number: '04', title: '优化 Amazon Listing', sub: '生成英文标题、五点描述和商品详情' },
  { number: '05', title: '自由对话', sub: '直接告诉我你现在最想解决的问题' },
];

export default function WelcomeScreen({ onAction }: { onAction: (title: string) => void }) {
  return (
    <div className="welcome dot-grid">
      <div className="welcome-inner">
        <div className="welcome-eyebrow">Your commerce creative partner</div>
        <h1 className="welcome-title">今天想卖点什么？</h1>
        <p className="welcome-sub">告诉我商品和目标平台，我会给你一份可以直接发布的内容。</p>
        <div className="memory-chip">● 已记住：XX美妆 · 护肤品 · 真实感 · 不要硬广</div>
        <div className="action-grid">
          {ACTIONS.map((action) => (
            <button className="quick-action" key={action.number} onClick={() => onAction(action.title)}>
              <div className="quick-number">{action.number}</div>
              <div className="quick-title">{action.title}</div>
              <div className="quick-sub">{action.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';

// App Router 错误边界：渲染异常不再白屏，可一键恢复
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="error-boundary">
      <div className="error-boundary-card">
        <strong>页面出了点问题</strong>
        <p>{error.message || '发生未知错误，请重试。'}</p>
        <div className="error-boundary-actions">
          <button onClick={reset}>重试</button>
          <button onClick={() => { window.location.href = window.location.pathname; }}>刷新页面</button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageTemplate, DesignTemplates } from '@/lib/api';
import { getDesignTemplates } from '@/lib/api';

async function apiPost(url: string, body: Record<string, unknown>) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: '请求失败' }));
    throw new Error((err as { detail?: string }).detail ?? '请求失败');
  }
  return resp.json();
}

export default function StudioView() {
  const [templates, setTemplates] = useState<DesignTemplates | null>(null);
  const [category, setCategory] = useState('lifestyle');
  const [selectedTemplate, setSelectedTemplate] = useState<ImageTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getDesignTemplates().then(setTemplates).catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleUpload = useCallback((file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('图片不能超过 5MB'); return; }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setSourceImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) handleUpload(file);
  }, [handleUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }, [handleUpload]);

  const selectTemplate = useCallback((t: ImageTemplate) => {
    setSelectedTemplate(t);
    setCustomPrompt('');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!sourceImage) return;
    const prompt = customPrompt.trim() || (selectedTemplate ? `Template: ${selectedTemplate.id}` : '');
    if (!prompt) return;

    setGenerating(true); setError(null); setGenStatus('正在生成...');
    try {
      const { task_id } = await apiPost('/shopgenie/api/studio/generate', {
        image_b64: sourceImage,
        prompt,
        size: selectedTemplate?.aspect_ratio === '9:16' ? '720*1280'
          : selectedTemplate?.aspect_ratio === '3:4' ? '768*1024' : '1024*1024',
      }) as { task_id: string };

      pollRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`/shopgenie/api/studio/generate/${task_id}`);
          const data = await resp.json() as { output: { task_status: string; results?: Array<{ url: string }> } };
          if (data.output.task_status === 'SUCCEEDED') {
            clearInterval(pollRef.current!);
            const url = data.output.results?.[0]?.url;
            if (url) setResults((prev) => [url, ...prev]);
            setGenStatus('');
            setGenerating(false);
          } else if (data.output.task_status === 'FAILED') {
            clearInterval(pollRef.current!);
            setError('生成失败，请重试');
            setGenerating(false);
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (e) {
      setError((e as Error).message);
      setGenerating(false);
    }
  }, [sourceImage, customPrompt, selectedTemplate]);

  const categories = templates?.categories ?? {};
  const filteredTemplates = templates?.templates.filter((t) =>
    categories[category]?.template_ids.includes(t.id)
  ) ?? [];

  return (
    <div className="studio-view dot-grid">
      <div className="studio-left">
        <div className="studio-section">
          <div className="workspace-section-title">商品照片</div>
          <div
            className={`studio-dropzone${sourceImage ? ' has-image' : ''}`}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            {sourceImage ? (
              <img src={sourceImage} alt="上传的商品图" />
            ) : (
              <div className="studio-dropzone-hint">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                <strong>点击或拖入商品照片</strong>
                <span>AI 自动识别产品主体，替换背景</span>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
          {sourceImage && (
            <button className="studio-reupload-btn" onClick={() => fileRef.current?.click()}>重新上传</button>
          )}
        </div>
      </div>

      <div className="studio-right">
        <div className="studio-section">
          <div className="workspace-section-title">场景模板</div>
          <div className="studio-categories">
            {Object.entries(categories).map(([key, val]) => (
              <button key={key} className={`studio-cat${category === key ? ' active' : ''}`} onClick={() => { setCategory(key); setSelectedTemplate(null); }}>{val.name}</button>
            ))}
          </div>
          <div className="studio-template-grid">
            {filteredTemplates.map((t) => (
              <button key={t.id} className={`studio-tpl${selectedTemplate?.id === t.id ? ' selected' : ''}`} onClick={() => selectTemplate(t)}>
                <strong>{t.name}</strong>
                <span>{t.description}</span>
                <small>{t.aspect_ratio}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="studio-section">
          <div className="workspace-section-title">场景描述（可选自定义）</div>
          <textarea className="studio-prompt" placeholder={selectedTemplate ? `基于「${selectedTemplate.name}」场景自动生成…` : '选择模板后自动填充，或手动输入场景描述…'} value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={3} maxLength={500} />
          <button className="studio-generate-btn" onClick={handleGenerate} disabled={!sourceImage || generating || (!customPrompt.trim() && !selectedTemplate)}>
            {generating ? '生成中…' : '生成场景图'}
          </button>
          {genStatus && <div className="studio-status">{genStatus}</div>}
          {error && <div className="workspace-error">{error}</div>}
        </div>

        {results.length > 0 && (
          <div className="studio-section">
            <div className="workspace-section-title">生成结果</div>
            <div className="studio-results">
              {results.map((url, i) => (
                <div key={i} className="studio-result-card"><img src={url} alt={`生成结果 ${i + 1}`} /></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageTemplate, DesignTemplates } from '@/lib/api';
import { getDesignTemplates, generateImage, pollImageTask } from '@/lib/api';

interface ImageGenPanelProps {
  open: boolean;
  onClose: () => void;
  product?: string;
  onImageGenerated?: (imageUrl: string) => void;
}

export default function ImageGenPanel({ open, onClose, product, onImageGenerated }: ImageGenPanelProps) {
  const [templates, setTemplates] = useState<DesignTemplates | null>(null);
  const [category, setCategory] = useState<string>('studio');
  const [selectedTemplate, setSelectedTemplate] = useState<ImageTemplate | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [size, setSize] = useState('1024*1024');
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && !templates) {
      getDesignTemplates().then(setTemplates).catch(() => setError('模板加载失败'));
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open, templates]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const selectTemplate = useCallback((t: ImageTemplate) => {
    setSelectedTemplate(t);
    setCustomPrompt('');
    setSize(t.aspect_ratio === '9:16' ? '720*1280' : t.aspect_ratio === '3:4' ? '768*1024' : '1024*1024');
  }, []);

  const handleGenerate = useCallback(async () => {
    const prompt = customPrompt.trim() || (selectedTemplate ? `Template: ${selectedTemplate.id}` : '');
    if (!prompt && !product) return;
    const finalPrompt = product ? `商品：${product}。${prompt}` : prompt;

    setGenerating(true); setError(null); setGeneratedUrl(null); setStatus('正在提交...');
    try {
      const { task_id } = await generateImage(finalPrompt, size);
      setStatus('正在生成图片，约需 10-30 秒...');
      pollRef.current = setInterval(async () => {
        try {
          const result = await pollImageTask(task_id);
          if (result.output.task_status === 'SUCCEEDED') {
            clearInterval(pollRef.current!);
            const url = result.output.results?.[0]?.url;
            if (url) {
              setGeneratedUrl(url);
              setStatus('');
              onImageGenerated?.(url);
            } else {
              setError('生成成功但未获取到图片 URL');
            }
            setGenerating(false);
          } else if (result.output.task_status === 'FAILED') {
            clearInterval(pollRef.current!);
            setError('图片生成失败，请重试');
            setGenerating(false);
          }
        } catch { /* keep polling */ }
      }, 2000);
    } catch (e) {
      setError((e as Error).message || '生成失败');
      setGenerating(false);
    }
  }, [customPrompt, selectedTemplate, product, size, onImageGenerated]);

  const categories = templates?.categories ?? {};
  const filteredTemplates = templates?.templates.filter(t =>
    categories[category]?.template_ids.includes(t.id)
  ) ?? [];

  if (!open) return null;

  return (
    <div className="image-gen-overlay" onClick={onClose}>
      <div className="image-gen-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="workspace-header">
          <div>
            <span>设计工具</span>
            <h2>AI 生图</h2>
            <p>通义万相 · 选模板或自定义 prompt 生成商品图</p>
          </div>
          <button onClick={onClose} aria-label="关闭">✕</button>
        </div>

        {/* Category tabs */}
        <div className="workspace-tabs">
          {Object.entries(categories).map(([key, val]) => (
            <button key={key} className={category === key ? 'active' : ''} onClick={() => { setCategory(key); setSelectedTemplate(null); }}>
              {val.name}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="image-gen-body">
          {/* Templates */}
          <div className="workspace-section-title">模板</div>
          <div className="image-gen-template-grid">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                className={`image-gen-tpl-card${selectedTemplate?.id === t.id ? ' selected' : ''}`}
                onClick={() => selectTemplate(t)}
              >
                <strong>{t.name}</strong>
                <span>{t.description}</span>
                <small>{t.aspect_ratio}</small>
              </button>
            ))}
          </div>

          {/* Custom prompt */}
          <div className="workspace-section-title" style={{ marginTop: 16 }}>Prompt</div>
          <textarea
            className="image-gen-prompt-input"
            placeholder={
              selectedTemplate
                ? `基于「${selectedTemplate.name}」模板自定义修改…`
                : product
                  ? `描述你想要的 ${product} 图片风格、场景、光线…`
                  : '描述你想要的图片风格、场景、光线…'
            }
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
            maxLength={500}
          />

          {/* Actions */}
          <div className="image-gen-action-row">
            <select value={size} onChange={(e) => setSize(e.target.value)} className="image-gen-size-select">
              <option value="1024*1024">1:1 方形</option>
              <option value="768*1024">3:4 竖图</option>
              <option value="720*1280">9:16 全屏</option>
            </select>
            <button
              className="image-gen-generate-btn"
              onClick={handleGenerate}
              disabled={generating || (!customPrompt.trim() && !selectedTemplate && !product)}
            >
              {generating ? '生成中…' : '生成图片'}
            </button>
          </div>

          {/* Status */}
          {status && !error && <div className="image-gen-status-msg">{status}</div>}
          {error && <div className="workspace-error">{error}</div>}

          {/* Preview */}
          {generatedUrl && (
            <div className="image-gen-preview-area">
              <img src={generatedUrl} alt="生成的商品图" />
              <div className="image-gen-preview-actions">
                <button onClick={() => window.open(generatedUrl, '_blank')}>查看大图</button>
                <button onClick={() => navigator.clipboard.writeText(generatedUrl)}>复制链接</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

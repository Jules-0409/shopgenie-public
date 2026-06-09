'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageTemplate, DesignTemplates } from '@/lib/api';
import { getDesignTemplates, generateImage, pollImageTask } from '@/lib/api';

interface ImageGenPanelProps {
  product?: string;
  onImageGenerated?: (imageUrl: string) => void;
}

export default function ImageGenPanel({ product, onImageGenerated }: ImageGenPanelProps) {
  const [open, setOpen] = useState(false);
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

  const selectTemplate = useCallback((t: ImageTemplate) => {
    setSelectedTemplate(t);
    setCustomPrompt('');
    setSize(t.aspect_ratio === '9:16' ? '720*1280' : t.aspect_ratio === '3:4' ? '768*1024' : '1024*1024');
  }, []);

  const handleGenerate = useCallback(async () => {
    const prompt = customPrompt.trim() || (selectedTemplate ? `Template: ${selectedTemplate.id}` : '');
    if (!prompt && !product) return;
    const finalPrompt = product
      ? `商品：${product}。${prompt}`
      : prompt;

    setGenerating(true); setError(null); setGeneratedUrl(null); setStatus('正在提交...');
    try {
      const { task_id } = await generateImage(finalPrompt, size);
      setStatus('正在生成图片...');
      pollRef.current = setInterval(async () => {
        try {
          const result = await pollImageTask(task_id);
          if (result.output.task_status === 'SUCCEEDED') {
            clearInterval(pollRef.current!);
            const url = result.output.results?.[0]?.url;
            if (url) {
              setGeneratedUrl(url);
              setStatus('生成完成！');
              onImageGenerated?.(url);
            } else {
              setError('生成成功但未获取到图片 URL');
            }
            setGenerating(false);
          } else if (result.output.task_status === 'FAILED') {
            clearInterval(pollRef.current!);
            setError('图片生成失败');
            setGenerating(false);
          }
        } catch {
          // keep polling
        }
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

  return (
    <div className="image-gen-panel">
      <button
        className={`image-gen-toggle${open ? ' active' : ''}`}
        onClick={() => setOpen(!open)}
        title="AI 生图"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
        <span>AI 生图</span>
      </button>

      {open && (
        <div className="image-gen-dropdown">
          <div className="image-gen-header">
            <strong>AI 商品图生成</strong>
            <span className="image-gen-powered">通义万相</span>
          </div>

          {/* Category tabs */}
          <div className="image-gen-categories">
            {Object.entries(categories).map(([key, val]) => (
              <button
                key={key}
                className={`image-gen-cat${category === key ? ' active' : ''}`}
                onClick={() => { setCategory(key); setSelectedTemplate(null); }}
              >
                {val.name}
              </button>
            ))}
          </div>

          {/* Templates */}
          <div className="image-gen-templates">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                className={`image-gen-tpl${selectedTemplate?.id === t.id ? ' selected' : ''}`}
                onClick={() => selectTemplate(t)}
              >
                <strong>{t.name}</strong>
                <span>{t.description}</span>
                <small>{t.aspect_ratio}</small>
              </button>
            ))}
          </div>

          {/* Custom prompt */}
          <textarea
            className="image-gen-prompt"
            placeholder={selectedTemplate
              ? `基于「${selectedTemplate.name}」模板自定义修改...`
              : product
                ? `描述你想要的 ${product} 图片风格...`
                : '选择模板或输入自定义描述...'}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            maxLength={500}
          />

          {/* Size + Generate */}
          <div className="image-gen-actions">
            <select value={size} onChange={(e) => setSize(e.target.value)} className="image-gen-size">
              <option value="1024*1024">1:1 方形</option>
              <option value="768*1024">3:4 竖图</option>
              <option value="720*1280">9:16 全屏</option>
            </select>
            <button
              className="image-gen-btn"
              onClick={handleGenerate}
              disabled={generating || (!customPrompt.trim() && !selectedTemplate && !product)}
            >
              {generating ? '生成中...' : '生成图片'}
            </button>
          </div>

          {/* Status */}
          {status && !error && (
            <div className="image-gen-status">
              {generating && <span className="image-gen-spinner" />}
              {status}
            </div>
          )}

          {/* Error */}
          {error && <div className="image-gen-error">{error}</div>}

          {/* Preview */}
          {generatedUrl && (
            <div className="image-gen-preview">
              <img src={generatedUrl} alt="生成的商品图" />
              <div className="image-gen-preview-actions">
                <button onClick={() => window.open(generatedUrl, '_blank')}>查看大图</button>
                <button onClick={() => navigator.clipboard.writeText(generatedUrl)}>复制链接</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

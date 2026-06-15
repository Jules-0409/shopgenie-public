'use client';

import { useCallback, useState } from 'react';
import { AmazonMark, DyMark, IconCamera, IconComment, IconCopy, IconHeart, IconRefresh, IconStar, XhsMark } from './Icons';
import type { GeneratedContent, QualityReport } from '@/lib/api';
import { PLATFORM_LABELS, type Platform } from '@/lib/platforms';

function renderPlaceholder(text: string) {
  const parts = text.split(/(\\[待补充[^\\]]*\\])/g);
  if (parts.length === 1) return text;
  return parts.map((part, index) => {
    if (part.startsWith('[待补充')) {
      const label = part.slice(4, -1) || '请补充';
      return <span key={index} className="placeholder-badge">{label}</span>;
    }
    return part;
  });
}

const PlatformIcon = ({ platform }: { platform: Platform }) => {
  if (platform === 'xhs') return <XhsMark />;
  if (platform === 'dy') return <DyMark />;
  if (platform === 'cs') return <IconComment />;
  return <AmazonMark />;
};

/* Drag-and-drop image zone */

function useDropImage() {
  const [image, setImage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  return { image, setImage, dragOver, onDragOver, onDragLeave, onDrop };
}

/* Preview components */

const XhsPreview = ({ card, brandName, image, dragOver, onDragOver, onDragLeave, onDrop }: {
  card: GeneratedContent; brandName: string;
  image: string | null; dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
}) => (
  <div className="xhs-phone">
    <div className="phone-status"><span>9:41</span><b>● ● ●</b></div>
    <div className="xhs-nav"><span>‹</span><strong>笔记预览</strong><span>•••</span></div>
    <div className="app-profile"><span>{brandName.trim().slice(0, 1) || '品'}</span><div><strong>{brandName}</strong><small>刚刚发布</small></div><b>关注</b></div>
    <div
      className={`xhs-preview-cover${dragOver ? ' drag-over' : ''}${image ? ' has-image' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {image
        ? <img src={image} alt="预览图" />
        : <><IconCamera /><span>拖入图片替换首图 · 建议 3:4 竖图</span></>}
    </div>
    <div className="app-content"><h2>{renderPlaceholder(card.title)}</h2><div className="app-body">{renderPlaceholder(card.body)}</div><div className="post-tags">{card.tags.map((tag) => <span className="post-tag" key={tag}>#{tag}</span>)}</div></div>
    <div className="xhs-actions"><span>说点什么...</span><IconHeart /><IconStar /><IconComment /></div>
  </div>
);

const DouyinPreview = ({ card, brandName, image, dragOver, onDragOver, onDragLeave, onDrop }: {
  card: GeneratedContent; brandName: string;
  image: string | null; dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
}) => (
  <div className="douyin-preview-shell">
    <div className="douyin-phone">
      <div className="dy-top"><span>推荐</span><b>关注</b><span>搜索</span></div>
      <div
        className={`dy-camera${dragOver ? ' drag-over' : ''}${image ? ' has-image' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {image
          ? <img src={image} alt="预览视频封面" />
          : <><IconCamera /><span>按分镜拍摄后在这里预览成片 · 拖入图片替换</span></>}
      </div>
      <div className="dy-caption"><strong>@{brandName}</strong><p>{card.title}</p><span>{card.tags.map((tag) => `#${tag}`).join(' ')}</span></div>
      <div className="dy-side-actions"><b>{brandName.trim().slice(0, 1) || '品'}</b><span>♡<small>点赞</small></span><span>○<small>评论</small></span><span>↗<small>分享</small></span></div>
    </div>
    <div className="dy-script-panel">
      <div className="script-panel-title"><span>拍摄脚本</span><b>{card.sections.length || 1} 个分镜</b></div>
      {(card.sections.length ? card.sections : [{ label: '完整脚本', content: card.body }]).map((section) => (
        <div className="script-section" key={section.label}><b>{section.label}</b><p>{renderPlaceholder(section.content)}</p></div>
      ))}
    </div>
  </div>
);

const DouyinProductCopyPreview = ({ card }: { card: GeneratedContent }) => (
  <div className="douyin-copy-preview">
    <div className="douyin-copy-head">
      <span>抖音小店商品文案</span>
      <b>可直接复制上架</b>
    </div>
    <section>
      <small>商品标题</small>
      <h2>{renderPlaceholder(card.title)}</h2>
    </section>
    <section>
      <small>商品详情</small>
      <p>{renderPlaceholder(card.body)}</p>
    </section>
    <div className="douyin-copy-sections">
      {card.sections.map((section) => (
        <section key={section.label}>
          <small>{section.label}</small>
          <p>{renderPlaceholder(section.content)}</p>
        </section>
      ))}
    </div>
    {card.tags.length > 0 && <div className="post-tags">{card.tags.map((tag) => <span className="post-tag" key={tag}>#{tag}</span>)}</div>}
  </div>
);

const AmazonPreview = ({ card, image, dragOver, onDragOver, onDragLeave, onDrop }: {
  card: GeneratedContent;
  image: string | null; dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void;
}) => (
  <div className="amazon-app-preview">
    <div className="amazon-app-header"><AmazonMark s={16} /> amazon <span>Search products</span></div>
    <div className="amazon-breadcrumb">Beauty & Personal Care › Product detail preview</div>
    <div className="amazon-product">
      <div className="amazon-gallery">
        <div className="amazon-thumbnails"><i /><i /><i /></div>
        <div
          className={`amazon-image${dragOver ? ' drag-over' : ''}${image ? ' has-image' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {image
            ? <img src={image} alt="商品主图" />
            : <><IconCamera /><span>MAIN PRODUCT IMAGE · 拖入图片替换</span></>}
        </div>
      </div>
      <div className="amazon-detail"><h2>{renderPlaceholder(card.title)}</h2><div className="amazon-rating">★★★★★</div><strong>About this item</strong>
        <ul>{(card.sections.length ? card.sections : [{ label: 'Product description', content: card.body }]).map((section) => <li key={section.label}><b>{section.label}:</b> {renderPlaceholder(section.content)}</li>)}</ul>
        <div className="amazon-description"><strong>Product description</strong><p>{renderPlaceholder(card.body)}</p></div>
      </div>
      <aside className="amazon-buybox"><span>Offer details not provided</span><b>In Stock</b><button>Add to Cart</button><button>Buy Now</button><small>Preview only · verify offer details before publishing</small></aside>
    </div>
  </div>
);

/* CS preview — clean card layout, no phone mockup */
const CSPreview = ({ card, onTweakVariant }: { card: GeneratedContent; onTweakVariant?: (label: string, tweak: string) => void }) => {
  const [activePlatform, setActivePlatform] = useState<'taobao' | 'xhs' | 'dy'>('taobao');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [tweakingId, setTweakingId] = useState<string | null>(null);
  const [tweakValue, setTweakValue] = useState('');
  
  // Local manual edits
  const [editedText, setEditedText] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTextVal, setEditTextVal] = useState('');

  // Selected variant per scenario section index
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<Record<number, number>>({});

  const handleCopyVariant = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1500);
  };

  const getCustomerQuestion = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes('发货') || l.includes('物流') || l.includes('快递') || l.includes('送达')) {
      return '你好，请问我刚下单的宝贝什么时候能发货？大概几天能收到？';
    }
    if (l.includes('售后') || l.includes('退') || l.includes('换') || l.includes('坏') || l.includes('漏') || l.includes('破损')) {
      return '客服在吗？我收到的包裹有点破损，而且里面的东西好像漏了一些，这该怎么处理啊？可以给我退换吗？';
    }
    if (l.includes('尺码') || l.includes('规格') || l.includes('大小') || l.includes('多大') || l.includes('推荐')) {
      return '你好，我是第一次买你家的这个，身高 168cm 体重 115 斤，请问建议买什么规格的比较合适？';
    }
    if (l.includes('优惠') || l.includes('折扣') || l.includes('便宜') || l.includes('活动') || l.includes('券') || l.includes('差价')) {
      return '你好呀，请问现在店里有什么优惠券可以领吗？买两件能打折或者送赠品不？';
    }
    if (l.includes('正品') || l.includes('质量') || l.includes('真') || l.includes('假') || l.includes('靠谱')) {
      return '你好，我想问下这是正品吗？有正品保障或者官方质检证书吗？有点担心质量。';
    }
    if (l.includes('使用') || l.includes('怎么用') || l.includes('说明') || l.includes('教程') || l.includes('方法')) {
      return '你好，我收到的宝贝怎么使用啊？有什么需要特别注意的禁忌或者正确手法吗？';
    }
    return `你好，我想咨询一下关于“${label}”的具体情况。`;
  };

  return (
    <div className="cs-preview-shell">
      {/* Platform selector */}
      <div className="cs-platform-selector">
        <button 
          className={`cs-platform-tab taobao ${activePlatform === 'taobao' ? 'active' : ''}`}
          onClick={() => setActivePlatform('taobao')}
        >
          <span className="platform-tab-icon taobao">旺</span>
          淘宝旺旺风格
        </button>
        <button 
          className={`cs-platform-tab xhs ${activePlatform === 'xhs' ? 'active' : ''}`}
          onClick={() => setActivePlatform('xhs')}
        >
          <span className="platform-tab-icon xhs">红</span>
          小红书私信风格
        </button>
        <button 
          className={`cs-platform-tab dy ${activePlatform === 'dy' ? 'active' : ''}`}
          onClick={() => setActivePlatform('dy')}
        >
          <span className="platform-tab-icon dy">抖</span>
          抖音私信风格
        </button>
      </div>

      <div className="cs-intro">
        <p>{card.body}</p>
      </div>

      <div className="cs-scenarios">
        {card.sections.map((section, sIdx) => {
          const rawVariants = section.content.split('---').map(v => v.trim()).filter(Boolean);
          if (rawVariants.length === 0) return null;
          
          const currentVarIdx = selectedVariantIdx[sIdx] ?? 0;
          const activeVarIdx = currentVarIdx < rawVariants.length ? currentVarIdx : 0;
          const originalText = rawVariants[activeVarIdx];
          const variantId = `${sIdx}-${activeVarIdx}`;
          const currentText = editedText[variantId] ?? originalText;

          const isCopied = copiedId === variantId;
          const isTweaking = tweakingId === variantId;
          const isEditing = editingId === variantId;

          const customerText = getCustomerQuestion(section.label);

          return (
            <div className={`cs-mock-container ${activePlatform}`} key={section.label}>
              {/* Scenario tag */}
              <div className="cs-mock-scenario-tag">
                场景 {sIdx + 1}：{section.label}
              </div>

              {/* IM Mock Header */}
              <div className="cs-mock-header">
                <div className="cs-mock-back-arrow">←</div>
                <div className="cs-mock-title-info">
                  <span className="cs-mock-name">
                    {activePlatform === 'taobao' ? '买家咨询 (淘宝旺旺)' : activePlatform === 'xhs' ? '小红书私信' : '抖音私信咨询'}
                  </span>
                  <span className="cs-mock-status">● 在线</span>
                </div>
                <div className="cs-mock-more-actions">•••</div>
              </div>

              {/* IM Mock Chat Area */}
              <div className="cs-mock-chat">
                {/* Customer Message (Left) */}
                <div className="cs-chat-row buyer">
                  <div className="cs-chat-avatar buyer">👤</div>
                  <div className="cs-chat-bubble-wrapper">
                    <div className="cs-chat-bubble buyer">{customerText}</div>
                    <span className="cs-chat-time">刚刚</span>
                  </div>
                </div>

                {/* CS Message (Right) */}
                <div className="cs-chat-row seller">
                  <div className="cs-chat-bubble-wrapper">
                    {isEditing ? (
                      <div className="cs-chat-bubble-edit">
                        <textarea
                          className="cs-edit-textarea"
                          value={editTextVal}
                          onChange={(e) => setEditTextVal(e.target.value)}
                          rows={4}
                        />
                        <div className="cs-edit-actions">
                          <button 
                            className="cs-edit-btn cancel" 
                            onClick={() => setEditingId(null)}
                          >
                            取消
                          </button>
                          <button 
                            className="cs-edit-btn save" 
                            onClick={() => {
                              setEditedText(prev => ({ ...prev, [variantId]: editTextVal }));
                              setEditingId(null);
                            }}
                          >
                            保存
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="cs-chat-bubble seller">
                        {currentText.split('\n').map((line, j) => (
                          <p key={j}>{line}</p>
                        ))}
                      </div>
                    )}
                    <span className="cs-chat-time">刚刚 · 发送成功</span>
                  </div>
                  <div className="cs-chat-avatar seller">🤖</div>
                </div>
              </div>

              {/* Variant selection bar */}
              {rawVariants.length > 1 && (
                <div className="cs-variant-selector">
                  {rawVariants.map((_, vIdx) => (
                    <button
                      key={vIdx}
                      className={`cs-variant-tab ${activeVarIdx === vIdx ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedVariantIdx(prev => ({ ...prev, [sIdx]: vIdx }));
                        if (editingId) setEditingId(null);
                      }}
                    >
                      方案 {vIdx + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Action Toolbar */}
              <div className="cs-mock-toolbar">
                <button
                  className={`cs-toolbar-btn ${isCopied ? 'success' : ''}`}
                  onClick={() => handleCopyVariant(currentText, variantId)}
                  disabled={isEditing}
                >
                  {isCopied ? '✓ 已复制' : '一键复制'}
                </button>
                <button
                  className={`cs-toolbar-btn ${isEditing ? 'active' : ''}`}
                  onClick={() => {
                    if (isEditing) {
                      setEditingId(null);
                    } else {
                      setEditingId(variantId);
                      setEditTextVal(currentText);
                    }
                  }}
                >
                  {isEditing ? '正在编辑' : '编辑修改'}
                </button>
                {onTweakVariant && (
                  <button
                    className={`cs-toolbar-btn ${isTweaking ? 'active' : ''}`}
                    onClick={() => {
                      if (isTweaking) {
                        setTweakingId(null);
                      } else {
                        setTweakingId(variantId);
                        setTweakValue('');
                      }
                    }}
                    disabled={isEditing}
                  >
                    AI 微调
                  </button>
                )}
              </div>

              {/* AI Tweak input box */}
              {isTweaking && onTweakVariant && (
                <div className="cs-variant-tweak-box">
                  <textarea
                    value={tweakValue}
                    onChange={(e) => setTweakValue(e.target.value)}
                    placeholder="输入对此回复方案的 AI 微调要求，例如：语气更热情一点、强调限时折扣..."
                    className="cs-tweak-textarea"
                    rows={2}
                  />
                  <button
                    className="cs-tweak-submit"
                    onClick={() => {
                      if (tweakValue.trim()) {
                        onTweakVariant(section.label, tweakValue.trim());
                        setTweakingId(null);
                      }
                    }}
                  >
                    确认微调
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function ResultCard({ card, brandName = '你的品牌', onRegenerate, quality, onEdit, warnings, onTweakVariant }: {
  card: GeneratedContent; brandName?: string; onRegenerate?: () => void; quality?: QualityReport; onEdit?: () => void; warnings?: string[];
  onTweakVariant?: (label: string, tweak: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { image, dragOver, onDragOver, onDragLeave, onDrop } = useDropImage();
  const copy = async () => {
    const sections = card.sections.map((section) => `${section.label}\n${section.content}`).join('\n\n');
    await navigator.clipboard.writeText(
      [card.title, card.body, sections, card.tags.map((tag) => `#${tag}`).join(' ')].filter(Boolean).join('\n\n'),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className={`result-card result-${card.platform}`}>
      <header className="result-toolbar">
        <div className="result-type"><PlatformIcon platform={card.platform} /> {PLATFORM_LABELS[card.platform]}应用预览</div>
        <div className="result-actions">
          {onRegenerate && <button className="action-button" onClick={onRegenerate}><IconRefresh /> 再来一版</button>}
          {onEdit && <button className="action-button" onClick={onEdit}>编辑与版本</button>}
          <button className={`action-button primary${copied ? ' copied' : ''}`} onClick={copy}><IconCopy /> {copied ? '✓ 已复制' : '复制全文'}</button>
        </div>
      </header>
      <div className={`result-stage stage-${card.platform}`}>
        {card.platform === 'xhs' && <XhsPreview card={card} brandName={brandName} image={image} dragOver={dragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} />}
        {card.platform === 'dy' && card.content_type === 'douyin_product_copy'
          ? <DouyinProductCopyPreview card={card} />
          : card.platform === 'dy' && <DouyinPreview card={card} brandName={brandName} image={image} dragOver={dragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} />}
        {card.platform === 'amazon' && <AmazonPreview card={card} image={image} dragOver={dragOver} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} />}
        {card.platform === 'cs' && <CSPreview card={card} onTweakVariant={onTweakVariant} />}
      </div>
      {/* 后端强契约保证：校验失败的成品不会到达这里，能渲染即代表结构校验通过 */}
      <footer className="result-footer"><span className="check">✓ 平台结构校验通过</span>{warnings?.some(w => w.includes('自动矫正')) && <span className="check" style={{ color: 'var(--warn, #b45309)' }}>⚠ 已自动矫正一次</span>}{quality && <span className={`quality-pill ${quality.score >= 80 ? 'good' : 'review'}`}>质量 {quality.score}</span>}<span className="tip">生成内容请在发布前核对产品事实</span></footer>
    </article>
  );
}

'use client';

import { useState } from 'react';
import { importPerformanceCsv, previewPerformanceCsv, type ContentAsset, type PerformanceCsvPreview } from '@/lib/api';
import { toast } from '@/lib/toast';

const CSV_HEADER = 'asset_id,impressions,clicks,add_to_carts,orders,refunds,revenue,ad_spend,notes';

export default function PerformanceCsvImport({ assets, onImported }: { assets: ContentAsset[]; onImported: () => Promise<void> }) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<PerformanceCsvPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setCsvText(await file.text());
    setPreview(null);
  };

  const validate = async () => {
    if (!csvText.trim() || busy) return;
    setBusy(true);
    try {
      setPreview(await previewPerformanceCsv(csvText));
    } catch (error) {
      setPreview(null);
      toast(error instanceof Error ? error.message : 'CSV 校验失败');
    } finally {
      setBusy(false);
    }
  };

  const importRows = async () => {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const result = await importPerformanceCsv(csvText);
      toast(`已导入 ${result.imported} 条效果数据`, 'success');
      setCsvText('');
      setPreview(null);
      await onImported();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'CSV 导入失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="performance-import">
      <div className="workspace-section-title">CSV 批量导入</div>
      <p>先预览校验，全部通过后才能导入。单次最多 500 行。</p>
      <label className="performance-file">选择 CSV 文件
        <input type="file" accept=".csv,text/csv" onChange={(event) => void loadFile(event.target.files?.[0])} />
      </label>
      <textarea aria-label="CSV 内容" value={csvText} onChange={(event) => { setCsvText(event.target.value); setPreview(null); }} rows={5} placeholder={`${CSV_HEADER}\n${assets[0]?.id ?? 'content_xxx'},1000,80,20,6,1,600,120,首轮投放`} />
      <div className="performance-import-actions">
        <button className="workspace-secondary" disabled={!csvText.trim() || busy} onClick={validate}>{busy ? '校验中…' : '预览校验'}</button>
        <button className="workspace-primary" disabled={!preview || busy} onClick={importRows}>确认导入</button>
      </div>
      {preview && <div className="performance-preview"><strong>校验通过：{preview.rows} 行</strong><span>预览前 {preview.preview.length} 行，确认后将新增效果记录。</span></div>}
      {assets.length > 0 && <div className="performance-asset-ids"><strong>可用内容资产 ID</strong>{assets.slice(0, 5).map((asset) => <code key={asset.id}>{asset.id} · {asset.name}</code>)}</div>}
    </div>
  );
}

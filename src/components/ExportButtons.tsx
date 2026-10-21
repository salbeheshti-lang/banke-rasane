'use client';

import { useState } from 'react';

interface ExportButtonsProps {
  ids?: number[];
  genreId?: string;
  search?: string;
  filter?: string;
  sort?: string;
}

export default function ExportButtons({ ids, genreId, search, filter, sort }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [showPreview, setShowPreview] = useState<'pdf' | 'excel' | null>(null);
  const [previewData, setPreviewData] = useState<{ url: string; type: string } | null>(null);
  
  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(format);
    try {
      const endpoint = format === 'pdf' ? '/api/export/pdf' : '/api/export/excel';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ids,
          genreId: genreId || 'all',
          search: search || '',
          filter: filter || 'all',
          sort: sort || 'newest',
          format: 'list',
        }),
      });
      
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      
      // Show preview
      setPreviewData({ 
        url, 
        type: format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      setShowPreview(format);
    } catch (e) {
      alert(`خطا در خروجی: ${e instanceof Error ? e.message : 'نامشخص'}`);
    } finally {
      setExporting(null);
    }
  };
  
  const handleDownload = () => {
    if (!previewData) return;
    const a = document.createElement('a');
    a.href = previewData.url;
    a.download = `banke-rasane-${Date.now()}.${showPreview === 'pdf' ? 'pdf' : 'xlsx'}`;
    a.click();
  };
  
  const closePreview = () => {
    if (previewData) {
      URL.revokeObjectURL(previewData.url);
    }
    setPreviewData(null);
    setShowPreview(null);
  };
  
  return (
    <>
      <button
        onClick={() => handleExport('pdf')}
        disabled={exporting !== null}
        className="cinema-button-secondary text-sm disabled:opacity-50"
      >
        {exporting === 'pdf' ? (
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
            در حال...
          </span>
        ) : (
          '📄 PDF'
        )}
      </button>
      
      <button
        onClick={() => handleExport('excel')}
        disabled={exporting !== null}
        className="cinema-button-secondary text-sm disabled:opacity-50"
      >
        {exporting === 'excel' ? (
          <span className="flex items-center gap-2">
            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
            در حال...
          </span>
        ) : (
          '📊 Excel'
        )}
      </button>
      
      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={closePreview}>
          <div 
            className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-5xl h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-dark-700">
              <h3 className="text-white font-bold">
                پیش‌نمایش {showPreview === 'pdf' ? 'PDF' : 'Excel'}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownload}
                  className="cinema-button text-sm"
                >
                  دانلود
                </button>
                <button
                  onClick={closePreview}
                  className="text-gray-400 hover:text-white p-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Preview content */}
            <div className="flex-1 bg-white">
              {showPreview === 'pdf' ? (
                <iframe
                  src={previewData.url}
                  className="w-full h-full"
                  title="PDF Preview"
                />
              ) : (
                <div className="p-8 text-center text-gray-600 h-full overflow-auto">
                  <p className="mb-4">فایل Excel آماده دانلود است</p>
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3 bg-cinema-600 text-white rounded-lg font-bold"
                  >
                    دانلود فایل Excel
                  </button>
                  <p className="mt-4 text-sm">
                    برای پیش‌نمایش کامل، فایل را دانلود و در Excel باز کنید
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface Report {
  id: number;
  title: string;
  type: string;
  count: number | null;
  filePath: string | null;
  createdAt: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    document.body.classList.add('app-content');
    return () => document.body.classList.remove('app-content');
  }, []);
  
  useEffect(() => {
    const mockReports: Report[] = [
      { id: 1, title: 'گزارش کامل برنامه‌ها - آذر ۱۴۰۴', type: 'pdf', count: 587, filePath: null, createdAt: '2026-10-15T10:00:00Z' },
      { id: 2, title: 'گزارش برنامه‌های دکور - مهر ۱۴۰۴', type: 'excel', count: 560, filePath: null, createdAt: '2026-10-10T14:30:00Z' },
      { id: 3, title: 'گزارش برنامه‌های مستند - مهر ۱۴۰۴', type: 'pdf', count: 6, filePath: null, createdAt: '2026-10-05T09:15:00Z' },
      { id: 4, title: 'گزارش برنامه‌های بدون بیننده', type: 'excel', count: 412, filePath: null, createdAt: '2026-09-28T16:45:00Z' },
    ];
    
    setTimeout(() => {
      setReports(mockReports);
      setLoading(false);
    }, 600);
  }, []);
  
  return (
    <div className="min-h-screen">
      <Sidebar />
      
      <main className="mr-72 p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ color: 'var(--cream-text)' }}
            >
              گزارش‌ها
            </h1>
            <p style={{ color: 'var(--cream-text-muted)' }}>تاریخچه خروجی‌های PDF و Excel</p>
          </div>
          <Link href="/programs" className="btn-primary">
            + خروجی جدید
          </Link>
        </header>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner"></div>
          </div>
        ) : reports.length === 0 ? (
          <div 
            className="text-center py-20"
            style={{ color: 'var(--cream-text-muted)' }}
          >
            <p className="mb-4">هنوز گزارشی ساخته نشده</p>
            <Link href="/programs" className="btn-primary inline-block">
              شروع کنید
            </Link>
          </div>
        ) : (
          <div className="liquid-glass overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ 
                  background: 'rgba(2, 144, 72, 0.06)',
                  borderBottom: '1px solid rgba(2, 144, 72, 0.15)',
                }}>
                  <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--cream-text-soft)' }}>#</th>
                  <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--cream-text-soft)' }}>عنوان</th>
                  <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--cream-text-soft)' }}>نوع</th>
                  <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--cream-text-soft)' }}>تعداد</th>
                  <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--cream-text-soft)' }}>تاریخ</th>
                  <th className="text-right p-4 text-xs font-bold" style={{ color: 'var(--cream-text-soft)' }}>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, idx) => (
                  <tr 
                    key={r.id} 
                    className="transition-colors hover:bg-white/50"
                    style={{ borderBottom: '1px solid rgba(2, 144, 72, 0.08)' }}
                  >
                    <td className="p-4 text-sm" style={{ color: 'var(--cream-text-muted)' }}>
                      {(idx + 1).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-4 text-sm font-medium" style={{ color: 'var(--cream-text)' }}>
                      {r.title}
                    </td>
                    <td className="p-4">
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                        style={r.type === 'pdf' 
                          ? { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }
                          : { background: 'rgba(2, 144, 72, 0.15)', color: 'var(--brand-green-dark)' }
                        }
                      >
                        {r.type === 'pdf' ? 'PDF' : 'Excel'}
                      </span>
                    </td>
                    <td className="p-4 text-sm" style={{ color: 'var(--cream-text-soft)' }}>
                      {r.count?.toLocaleString('fa-IR') || '-'}
                    </td>
                    <td className="p-4 text-sm" style={{ color: 'var(--cream-text-muted)' }}>
                      {new Date(r.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="p-4">
                      <button 
                        className="text-sm hover:underline"
                        style={{ color: 'var(--brand-green)' }}
                      >
                        مشاهده
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

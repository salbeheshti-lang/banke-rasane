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
    <div className="min-h-screen bg-dark-900">
      <Sidebar />
      
      <main className="mr-72 p-8">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">گزارش‌ها</h1>
            <p className="text-gray-500">تاریخچه خروجی‌های PDF و Excel</p>
          </div>
          <Link href="/programs" className="cinema-button">
            + خروجی جدید
          </Link>
        </header>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="mb-4">هنوز گزارشی ساخته نشده</p>
            <Link href="/programs" className="cinema-button inline-block">
              شروع کنید
            </Link>
          </div>
        ) : (
          <div className="cinema-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-dark-900/50 border-b border-dark-700">
                  <th className="text-right p-4 text-gray-400 font-bold text-sm">#</th>
                  <th className="text-right p-4 text-gray-400 font-bold text-sm">عنوان</th>
                  <th className="text-right p-4 text-gray-400 font-bold text-sm">نوع</th>
                  <th className="text-right p-4 text-gray-400 font-bold text-sm">تعداد</th>
                  <th className="text-right p-4 text-gray-400 font-bold text-sm">تاریخ</th>
                  <th className="text-right p-4 text-gray-400 font-bold text-sm">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, idx) => (
                  <tr key={r.id} className="border-b border-dark-700 hover:bg-dark-800/50 transition-colors">
                    <td className="p-4 text-gray-500 text-sm">{(idx + 1).toLocaleString('fa-IR')}</td>
                    <td className="p-4 text-white text-sm font-medium">{r.title}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${
                        r.type === 'pdf' 
                          ? 'bg-red-500/20 text-red-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {r.type === 'pdf' ? 'PDF' : 'Excel'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-300 text-sm">{r.count?.toLocaleString('fa-IR') || '-'}</td>
                    <td className="p-4 text-gray-400 text-sm">
                      {new Date(r.createdAt).toLocaleDateString('fa-IR')}
                    </td>
                    <td className="p-4">
                      <button className="text-cinema-400 hover:text-cinema-300 text-sm">
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

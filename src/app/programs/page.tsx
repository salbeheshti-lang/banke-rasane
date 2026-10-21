'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import ProgramCard from '@/components/ProgramCard';
import ProgramList from '@/components/ProgramList';
import ExportButtons from '@/components/ExportButtons';
import SocialCardDialog from '@/components/SocialCardDialog';

interface Program {
  id: number;
  title: string;
  titleEn: string | null;
  description: string | null;
  duration: number | null;
  episodeCount: number | null;
  viewersCount: number | null;
  hasImages: boolean;
  hasVideo: boolean;
  status: string;
  producer: string | null;
  director: string | null;
  presenter: string | null;
  channel: string | null;
  airDate: string | null;
  genre: { id: number; name: string; nameFa: string; color: string };
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'without-viewers' | 'with-viewers' | 'with-images';
type SortMode = 'newest' | 'oldest' | 'title' | 'viewers';

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [view, setView] = useState<ViewMode>('grid');
  const [genreId, setGenreId] = useState<string>('all');
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showSocialCard, setShowSocialCard] = useState(false);
  
  useEffect(() => {
    document.body.classList.add('app-content');
    return () => document.body.classList.remove('app-content');
  }, []);
  
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);
  
  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        search: debouncedSearch,
        filter,
        sort,
        ...(genreId !== 'all' && { genreId }),
      });
      
      const res = await fetch(`/api/programs?${params}`);
      if (!res.ok) throw new Error('Failed to load programs');
      
      const data = await res.json();
      setPrograms(data.programs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filter, sort, genreId]);
  
  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);
  
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };
  
  const selectAll = () => {
    if (selectedIds.length === programs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(programs.map(p => p.id));
    }
  };
  
  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionMode(false);
  };
  
  return (
    <div className="min-h-screen">
      <Sidebar />
      
      <main className="mr-72 p-8">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-bold mb-1"
              style={{ color: 'var(--cream-text)' }}
            >
              همهٔ برنامه‌ها
            </h1>
            <p style={{ color: 'var(--cream-text-muted)' }}>
              {total.toLocaleString('fa-IR')} برنامه • صفحه {page.toLocaleString('fa-IR')} از {totalPages.toLocaleString('fa-IR')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="btn-secondary text-sm">
              بازگشت
            </Link>
          </div>
        </header>
        
        {/* Toolbar */}
        <div className="liquid-glass p-4 mb-6 space-y-4">
          {/* Search and view mode */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <svg 
                className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2" 
                style={{ color: 'var(--cream-text-muted)' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو در عنوان، توضیحات، تهیه‌کننده..."
                className="glass-input pr-10"
              />
            </div>
            
            <div 
              className="flex items-center gap-2 rounded-xl p-1"
              style={{ 
                background: 'rgba(255, 255, 255, 0.5)',
                border: '1px solid rgba(2, 144, 72, 0.15)',
              }}
            >
              <button
                onClick={() => setView('grid')}
                className={`p-2 rounded-lg transition-colors ${view === 'grid' ? 'bg-brand-500 text-white' : 'text-ink-600 hover:text-brand-600'}`}
                title="نمایش شبکه‌ای"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-lg transition-colors ${view === 'list' ? 'bg-brand-500 text-white' : 'text-ink-600 hover:text-brand-600'}`}
                title="نمایش لیستی"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={selectionMode ? {
                background: 'rgba(2, 144, 72, 0.15)',
                border: '1px solid rgba(2, 144, 72, 0.3)',
                color: 'var(--brand-green-dark)',
              } : {
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(2, 144, 72, 0.15)',
                color: 'var(--cream-text-soft)',
              }}
            >
              {selectionMode ? '✓ حالت انتخاب' : 'انتخاب چندتایی'}
            </button>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ color: 'var(--cream-text-muted)' }} className="text-sm ml-2">فیلتر:</span>
            {([
              { key: 'all', label: 'همه' },
              { key: 'without-viewers', label: 'بدون بیننده' },
              { key: 'with-viewers', label: 'با بیننده' },
              { key: 'with-images', label: 'با تصویر' },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                style={filter === f.key ? {
                  background: 'linear-gradient(135deg, var(--brand-green) 0%, var(--brand-green-dark) 100%)',
                  color: 'white',
                } : {
                  background: 'rgba(255, 255, 255, 0.5)',
                  color: 'var(--cream-text-soft)',
                }}
              >
                {f.label}
              </button>
            ))}
            
            <div className="w-px h-6 bg-brand-500/20 mx-2"></div>
            
            <span style={{ color: 'var(--cream-text-muted)' }} className="text-sm ml-2">مرتب‌سازی:</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortMode); setPage(1); }}
              className="glass-input text-sm py-1.5"
              style={{ width: 'auto' }}
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="title">عنوان (الفبایی)</option>
              <option value="viewers">بیشترین بیننده</option>
            </select>
            
            <select
              value={genreId}
              onChange={(e) => { setGenreId(e.target.value); setPage(1); }}
              className="glass-input text-sm py-1.5"
              style={{ width: 'auto' }}
            >
              <option value="all">همه ژانرها</option>
              <option value="1">دکور برنامه‌ها</option>
              <option value="2">ریلیتی شو</option>
              <option value="3">مستندها</option>
              <option value="4">برنامه‌های خبری</option>
              <option value="5">مصاحبه‌ها</option>
              <option value="6">برنامه‌های کودک</option>
              <option value="7">ورزشی</option>
              <option value="8">موسیقی و کنسرت</option>
              <option value="9">آموزشی</option>
            </select>
          </div>
          
          {/* Selection toolbar */}
          {selectionMode && (
            <div 
              className="flex items-center gap-3 pt-3"
              style={{ borderTop: '1px solid rgba(2, 144, 72, 0.1)' }}
            >
              <span style={{ color: 'var(--brand-green-dark)' }} className="font-medium">
                {selectedIds.length.toLocaleString('fa-IR')} برنامه انتخاب شده
              </span>
              <button 
                onClick={selectAll} 
                className="text-sm hover:underline"
                style={{ color: 'var(--cream-text-soft)' }}
              >
                {selectedIds.length === programs.length ? 'لغو همه' : 'انتخاب همه'}
              </button>
              <button 
                onClick={clearSelection} 
                className="text-sm hover:underline"
                style={{ color: 'var(--cream-text-soft)' }}
              >
                پاک کردن
              </button>
              
              <div className="flex-1"></div>
              
              {selectedIds.length > 0 && (
                <>
                  <ExportButtons
                    ids={selectedIds}
                    genreId={genreId}
                    search={debouncedSearch}
                    filter={filter}
                    sort={sort}
                  />
                  <button
                    onClick={() => setShowSocialCard(true)}
                    className="btn-primary text-sm"
                  >
                    کارت شبکه اجتماعی
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Programs */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner"></div>
          </div>
        ) : programs.length === 0 ? (
          <div 
            className="text-center py-20"
            style={{ color: 'var(--cream-text-muted)' }}
          >
            <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>برنامه‌ای یافت نشد</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {programs.map(p => (
              <ProgramCard
                key={p.id}
                program={p}
                selectionMode={selectionMode}
                selected={selectedIds.includes(p.id)}
                onToggleSelect={() => toggleSelect(p.id)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map(p => (
              <ProgramList
                key={p.id}
                program={p}
                selectionMode={selectionMode}
                selected={selectedIds.includes(p.id)}
                onToggleSelect={() => toggleSelect(p.id)}
              />
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary text-sm disabled:opacity-30"
            >
              قبلی
            </button>
            <span style={{ color: 'var(--cream-text-soft)' }} className="px-4">
              {page.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary text-sm disabled:opacity-30"
            >
              بعدی
            </button>
          </div>
        )}
      </main>
      
      {/* Social Card Dialog */}
      {showSocialCard && (
        <SocialCardDialog
          programIds={selectedIds}
          onClose={() => setShowSocialCard(false)}
        />
      )}
    </div>
  );
}

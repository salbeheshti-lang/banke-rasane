'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import ProgramCard from '@/components/ProgramCard';
import ProgramList from '@/components/ProgramList';
import ExportButtons from '@/components/ExportButtons';

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

export default function GenrePage() {
  const params = useParams();
  const genreId = params.id as string;
  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [genre, setGenre] = useState<any>(null);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [view, setView] = useState<ViewMode>('grid');
  
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
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
        genreId,
      });
      
      const res = await fetch(`/api/programs?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPrograms(data.programs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.programs[0]?.genre) {
        setGenre(data.programs[0].genre);
      }
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
  
  return (
    <div className="min-h-screen">
      <Sidebar />
      
      <main className="mr-72 p-8">
        {/* Header with genre color */}
        {genre && (
          <header 
            className="liquid-glass mb-6 p-6 relative overflow-hidden"
          >
            <div className="flex items-center gap-4 relative z-10">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black"
                style={{ 
                  backgroundColor: `${genre.color}20`, 
                  color: genre.color,
                  boxShadow: `0 0 30px ${genre.color}40`,
                }}
              >
                {genre.nameFa.charAt(0)}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white mb-1">{genre.nameFa}</h1>
                <p className="text-gray-400">{genre.name} • {total.toLocaleString('fa-IR')} برنامه</p>
              </div>
              <Link href="/dashboard" className="cinema-button-secondary">
                بازگشت
              </Link>
            </div>
          </header>
        )}
        
        {/* Toolbar */}
        <div className="cinema-card p-4 mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <svg className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجو..."
                className="cinema-input w-full pr-10"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-dark-900 rounded-lg p-1">
              <button
                onClick={() => setView('grid')}
                className={`p-2 rounded-md ${view === 'grid' ? 'bg-cinema-600 text-white' : 'text-gray-400'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 rounded-md ${view === 'list' ? 'bg-cinema-600 text-white' : 'text-gray-400'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
            
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              className={`px-4 py-2 rounded-lg border ${
                selectionMode ? 'bg-cinema-600/20 border-cinema-600 text-cinema-400' : 'border-dark-600 text-gray-400'
              }`}
            >
              {selectionMode ? '✓ انتخاب' : 'انتخاب'}
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {([
              { key: 'all', label: 'همه' },
              { key: 'without-viewers', label: 'بدون بیننده' },
              { key: 'with-viewers', label: 'با بیننده' },
              { key: 'with-images', label: 'با تصویر' },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  filter === f.key ? 'bg-cinema-600 text-white' : 'bg-dark-700 text-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
            
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortMode); setPage(1); }}
              className="cinema-input text-sm py-1.5"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
              <option value="title">عنوان</option>
              <option value="viewers">بیشترین بیننده</option>
            </select>
          </div>
          
          {selectionMode && (
            <div className="flex items-center gap-3 pt-3 border-t border-dark-700">
              <span className="text-cinema-400 font-medium">
                {selectedIds.length.toLocaleString('fa-IR')} انتخاب شده
              </span>
              <ExportButtons
                ids={selectedIds}
                genreId={genreId}
                search={debouncedSearch}
                filter={filter}
                sort={sort}
              />
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner"></div>
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>برنامه‌ای در این ژانر یافت نشد</p>
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
        
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="cinema-button-secondary disabled:opacity-30"
            >
              قبلی
            </button>
            <span className="text-gray-400 px-4">
              {page.toLocaleString('fa-IR')} / {totalPages.toLocaleString('fa-IR')}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="cinema-button-secondary disabled:opacity-30"
            >
              بعدی
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

interface Genre {
  id: number;
  key: string;
  name: string;
  nameFa: string;
  color: string;
  description: string | null;
  order: number;
  _count: { programs: number };
}

interface Stats {
  totalPrograms: number;
  totalGenres: number;
  totalViewers: number;
  withImages: number;
  withoutViewers: number;
}

export default function DashboardPage() {
  const [genres, setGenres] = useState<Genre[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    document.body.classList.add('app-content');
    return () => document.body.classList.remove('app-content');
  }, []);
  
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [genresRes, statsRes] = await Promise.all([
          fetch('/api/genres'),
          fetch('/api/stats'),
        ]);
        
        if (!genresRes.ok || !statsRes.ok) {
          throw new Error('Failed to load data');
        }
        
        const genresData = await genresRes.json();
        const statsData = await statsRes.json();
        
        setGenres(genresData.genres || []);
        setStats(statsData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);
  
  return (
    <div className="min-h-screen">
      <Sidebar />
      
      <main className="mr-72 p-8">
        {/* Header */}
        <header className="mb-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-2">
            <h1 
              className="text-3xl font-bold"
              style={{ color: 'var(--cream-text)' }}
            >
              داشبورد
            </h1>
            <span 
              className="text-sm px-3 py-1 rounded-full"
              style={{ 
                background: 'rgba(2, 144, 72, 0.1)',
                color: 'var(--brand-green-dark)',
              }}
            >
              بانک رسانه
            </span>
          </div>
          <p style={{ color: 'var(--cream-text-muted)' }}>
            به بانک رسانه خوش آمدید - مرور کلی برنامه‌ها
          </p>
        </header>
        
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-slide-up">
            <StatCard 
              label="کل برنامه‌ها" 
              value={stats.totalPrograms} 
              color="#029048"
              icon="film"
            />
            <StatCard 
              label="ژانرها" 
              value={stats.totalGenres} 
              color="#2563eb"
              icon="tag"
            />
            <StatCard 
              label="بیننده‌ها" 
              value={stats.totalViewers} 
              color="#d97706"
              icon="eye"
            />
            <StatCard 
              label="با تصویر" 
              value={stats.withImages} 
              color="#db2777"
              icon="image"
            />
          </div>
        )}
        
        {/* Genres grid */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 
              className="text-xl font-bold"
              style={{ color: 'var(--cream-text)' }}
            >
              ژانرها
            </h2>
            <Link 
              href="/programs" 
              className="text-sm font-medium hover:underline"
              style={{ color: 'var(--brand-green)' }}
            >
              مشاهده همه ←
            </Link>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div 
                  key={i} 
                  className="h-44 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(255, 255, 255, 0.4)' }}
                ></div>
              ))}
            </div>
          ) : error ? (
            <div 
              className="rounded-2xl p-6"
              style={{ 
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                color: '#dc2626'
              }}
            >
              <p>خطا در بارگذاری: {error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-3 px-4 py-2 rounded-lg"
                style={{ background: 'rgba(220, 38, 38, 0.15)' }}
              >
                تلاش مجدد
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {genres.map((g, idx) => (
                <GenreCard key={g.id} genre={g} index={idx} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <div className="liquid-glass p-5 relative overflow-hidden">
      <div 
        className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-25"
        style={{ backgroundColor: color }}
      ></div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ 
              backgroundColor: `${color}18`, 
              color,
              border: `1px solid ${color}30`,
            }}
          >
            <StatIcon name={icon} />
          </div>
          <span style={{ color: 'var(--cream-text-soft)' }} className="text-sm font-medium">{label}</span>
        </div>
        <div 
          className="text-3xl font-black"
          style={{ color: 'var(--cream-text)' }}
        >
          {value.toLocaleString('fa-IR')}
        </div>
      </div>
    </div>
  );
}

function StatIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    film: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />,
    tag: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />,
    eye: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
    image: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  };
  
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
}

function GenreCard({ genre, index }: { genre: Genre; index: number }) {
  return (
    <Link
      href={`/genre/${genre.id}`}
      className={`liquid-glass genre-${genre.id} block animate-slide-up p-5`}
      style={{ 
        animationDelay: `${index * 60}ms`,
        opacity: 0,
      }}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{ 
              backgroundColor: `${genre.color}18`, 
              color: genre.color,
              border: `1px solid ${genre.color}30`,
              boxShadow: `0 4px 16px ${genre.color}20`,
            }}
          >
            {genre.nameFa.charAt(0)}
          </div>
          <div className="text-left">
            <div 
              className="text-4xl font-black"
              style={{ color: 'var(--cream-text)' }}
            >
              {genre._count.programs.toLocaleString('fa-IR')}
            </div>
            <div style={{ color: 'var(--cream-text-muted)' }} className="text-xs">برنامه</div>
          </div>
        </div>
        
        <h3 
          className="font-bold text-lg mb-1"
          style={{ color: 'var(--cream-text)' }}
        >
          {genre.nameFa}
        </h3>
        <p style={{ color: 'var(--cream-text-muted)' }} className="text-xs">{genre.name}</p>
        
        {genre.description && (
          <p style={{ color: 'var(--cream-text-soft)' }} className="text-sm mt-3 line-clamp-2">
            {genre.description}
          </p>
        )}
        
        <div 
          className="mt-4 flex items-center text-sm font-medium"
          style={{ color: genre.color }}
        >
          مشاهده برنامه‌ها
          <svg className="w-4 h-4 mr-1 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

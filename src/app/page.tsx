'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

// ============================================
// MOCK DATA - 9 genres, 587 programs total
// ============================================
const GENRES = [
  { id: 1, key: 'decor', nameFa: 'دکور برنامه‌ها', name: 'Decor Shows', color: '#029048', count: 560, description: 'برنامه‌های دکور و تنوع' },
  { id: 2, key: 'reality', nameFa: 'ریلیتی شو', name: 'Reality Shows', color: '#dc2626', count: 6, description: 'برنامه‌های واقع‌نما' },
  { id: 3, key: 'documentary', nameFa: 'مستندها', name: 'Documentaries', color: '#2563eb', count: 6, description: 'مستندهای تلویزیونی' },
  { id: 4, key: 'news', nameFa: 'برنامه‌های خبری', name: 'News Programs', color: '#d97706', count: 4, description: 'برنامه‌های خبری و تحلیلی' },
  { id: 5, key: 'interview', nameFa: 'مصاحبه‌ها', name: 'Interviews', color: '#7c3aed', count: 0, description: 'مصاحبه‌ها و گفتگوها' },
  { id: 6, key: 'kids', nameFa: 'برنامه‌های کودک', name: 'Kids Programs', color: '#db2777', count: 3, description: 'برنامه‌های کودک و نوجوان' },
  { id: 7, key: 'sports', nameFa: 'ورزشی', name: 'Sports', color: '#0d9488', count: 2, description: 'برنامه‌های ورزشی' },
  { id: 8, key: 'music', nameFa: 'موسیقی و کنسرت', name: 'Music & Concerts', color: '#ea580c', count: 3, description: 'برنامه‌های موسیقی' },
  { id: 9, key: 'education', nameFa: 'آموزشی', name: 'Educational', color: '#4f46e5', count: 3, description: 'برنامه‌های آموزشی' },
];

const SAMPLE_TITLES = [
  'برنامه نمونه', 'ویژه برنامه', 'مجموعه برنامه‌ها', 'برنامه هفتگی',
  'ویژه ماهانه', 'برنامه فصلی', 'مجموعه نمایشی', 'برنامه زنده',
];
const PRODUCERS = ['مرکز صدا و سیما', 'شبکه یک', 'شبکه دو', 'شبکه سه', 'شبکه آموزش'];

function generatePrograms(genreId: number, count: number) {
  const genre = GENRES.find(g => g.id === genreId)!;
  const programs = [];
  for (let i = 1; i <= count; i++) {
    programs.push({
      id: genreId * 1000 + i,
      title: `${SAMPLE_TITLES[i % SAMPLE_TITLES.length]} ${i} - ${genre.nameFa}`,
      description: `برنامه نمونه شماره ${i} در دسته‌بندی ${genre.nameFa}. این برنامه به‌عنوان نمونه در بانک رسانه ثبت شده است.`,
      duration: 30 + (i % 60),
      episodeCount: 1 + (i % 12),
      viewersCount: i % 4 === 0 ? Math.floor(Math.random() * 10000) : 0,
      hasImages: i % 3 === 0,
      hasVideo: i % 5 === 0,
      producer: PRODUCERS[i % PRODUCERS.length],
      genre,
    });
  }
  return programs;
}

const ALL_PROGRAMS = GENRES.flatMap(g => generatePrograms(g.id, Math.min(g.count, 50)));

function toFa(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '-';
  return n.toLocaleString('fa-IR');
}

// ============================================
// MAIN APP COMPONENT
// ============================================
export default function Home() {
  const [view, setView] = useState<'app' | 'code'>('app');
  const [screen, setScreen] = useState<'login' | 'dashboard' | 'programs' | 'genre' | 'reports'>('login');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleEnter = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setScreen('dashboard');
    }, 600);
  };
  
  if (screen === 'login') {
    return <LoginScreen onEnter={handleEnter} loading={loading} view={view} setView={setView} />;
  }
  
  if (view === 'code') {
    return <CodeView onBack={() => setView('app')} />;
  }
  
  return (
    <div className="app-content min-h-screen">
      <Sidebar 
        currentScreen={screen} 
        onNavigate={(s) => {
          setScreen(s);
          if (s === 'genre') setSelectedGenre(null);
        }}
        onGenreSelect={(id) => {
          setSelectedGenre(id);
          setScreen('genre');
        }}
        onLogout={() => setScreen('login')}
      />
      <main className="mr-72 p-8">
        {screen === 'dashboard' && <Dashboard onGenreClick={(id) => { setSelectedGenre(id); setScreen('genre'); }} />}
        {screen === 'programs' && <ProgramsView />}
        {screen === 'genre' && selectedGenre && <GenreView genreId={selectedGenre} />}
        {screen === 'reports' && <ReportsView />}
      </main>
    </div>
  );
}

// ============================================
// LOGIN SCREEN - Cinematic green with logo
// ============================================
function LoginScreen({ onEnter, loading, view, setView }: { 
  onEnter: () => void; 
  loading: boolean;
  view: 'app' | 'code';
  setView: (v: 'app' | 'code') => void;
}) {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => { setIsReady(true); }, []);
  
  return (
    <div className="login-screen min-h-screen relative flex items-center justify-center">
      <div className="login-ambient-light green-1"></div>
      <div className="login-ambient-light green-2"></div>
      <div className="login-ambient-light green-3"></div>
      
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(74, 222, 128, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 222, 128, 1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          zIndex: 1,
        }}
      ></div>
      
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-green-500 to-transparent opacity-40 z-10"></div>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-green-500 to-transparent opacity-40 z-10"></div>
      
      {/* Top right toggle */}
      <div className="absolute top-4 left-4 z-30 flex gap-2">
        <button
          onClick={() => setView('app')}
          style={{
            padding: '6px 12px',
            background: view === 'app' ? 'rgba(2, 144, 72, 0.3)' : 'rgba(255,255,255,0.05)',
            color: view === 'app' ? '#4ade80' : 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(2, 144, 72, 0.3)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          📱 نمایش برنامه
        </button>
        <button
          onClick={() => setView('code')}
          style={{
            padding: '6px 12px',
            background: view === 'code' ? 'rgba(2, 144, 72, 0.3)' : 'rgba(255,255,255,0.05)',
            color: view === 'code' ? '#4ade80' : 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(2, 144, 72, 0.3)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {'</>'} نمایش کد
        </button>
      </div>
      
      {view === 'code' ? (
        <CodeView onBack={() => setView('app')} />
      ) : (
        <div 
          className={`relative z-20 text-center px-8 transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
          style={{ maxWidth: '900px' }}
        >
          {/* Logo with motion */}
          <div className="mb-10 flex justify-center">
            <div className="logo-motion logo-glow">
              <div className="relative">
                <div 
                  className="absolute inset-0 blur-3xl rounded-full"
                  style={{ 
                    background: 'radial-gradient(circle, rgba(2, 144, 72, 0.6) 0%, transparent 70%)',
                    transform: 'scale(1.2)',
                  }}
                ></div>
                <div className="relative">
                  <Image
                    src="/banke-rasane-logo.png"
                    alt="بانک رسانه"
                    width={360}
                    height={200}
                    priority
                    className="relative z-10"
                    style={{
                      filter: 'drop-shadow(0 8px 32px rgba(2, 144, 72, 0.4))',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Tagline */}
          <div className="mb-12 animate-fade-in" style={{ animationDelay: '0.3s', opacity: 0 }}>
            <p 
              className="text-xl font-light mb-2 tracking-wide"
              style={{ 
                color: '#a8e6c1',
                textShadow: '0 2px 12px rgba(2, 144, 72, 0.5)',
              }}
            >
              دسترسی به دنیای بی‌پایان محتوا
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-green-500/60"></span>
              <span className="text-green-300/70 text-sm font-light tracking-widest">
                آرشیو • جستجو • تماشا
              </span>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-green-500/60"></span>
            </div>
          </div>
          
          {/* Enter button - solid green with white text */}
          <button
            onClick={onEnter}
            disabled={loading}
            className="group relative px-14 py-4 text-lg overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #029048 0%, #027940 100%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(2, 144, 72, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              cursor: loading ? 'wait' : 'pointer',
              color: 'white',
              fontWeight: 600,
              fontSize: '18px',
            }}
          >
            <span className="relative z-10 flex items-center gap-3 justify-center">
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span style={{ color: 'white' }}>در حال ورود...</span>
                </>
              ) : (
                <>
                  <span style={{ color: 'white', fontWeight: 600 }}>
                    ورود به برنامه
                  </span>
                  <svg 
                    className="w-5 h-5 rtl-flip group-hover:-translate-x-1 transition-transform" 
                    fill="none" 
                    stroke="white" 
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </span>
            
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
                animation: 'logo-sweep 2s ease-in-out infinite',
              }}
            ></div>
          </button>
          
          <div className="absolute bottom-8 left-0 right-0 text-center z-20">
            <p style={{ color: 'rgba(168, 230, 193, 0.5)' }} className="text-xs tracking-wider">
              نسخه 1.2.0 • © 2026 salbeheshti-lang
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// SIDEBAR
// ============================================
function Sidebar({ 
  currentScreen, 
  onNavigate, 
  onGenreSelect, 
  onLogout 
}: {
  currentScreen: string;
  onNavigate: (s: 'dashboard' | 'programs' | 'reports') => void;
  onGenreSelect: (id: number) => void;
  onLogout: () => void;
}) {
  const navItems = [
    { key: 'dashboard', label: 'داشبورد', icon: 'home' },
    { key: 'programs', label: 'همهٔ برنامه‌ها', icon: 'grid' },
    { key: 'reports', label: 'گزارش‌ها', icon: 'reports' },
  ];
  
  return (
    <aside 
      className="fixed right-0 top-0 h-screen w-72 z-40"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderLeft: '1px solid rgba(2, 144, 72, 0.15)',
        boxShadow: '-4px 0 24px rgba(2, 144, 72, 0.06)',
      }}
    >
      <div 
        className="p-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(2, 144, 72, 0.1)' }}
      >
        <Image
          src="/banke-rasane-logo.png"
          alt="بانک رسانه"
          width={120}
          height={32}
          priority
        />
      </div>
      
      <nav className="p-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentScreen === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key as any)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all w-full"
                style={isActive ? {
                  background: 'linear-gradient(135deg, rgba(2, 144, 72, 0.12) 0%, rgba(2, 144, 72, 0.06) 100%)',
                  border: '1px solid rgba(2, 144, 72, 0.2)',
                  color: '#016035',
                } : {
                  border: '1px solid transparent',
                  color: '#2a4538',
                }}
              >
                <NavIcon name={item.icon} />
                <span className="font-medium text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
        
        <div className="mt-6">
          <h3 style={{ color: '#7a8a80' }} className="text-xs font-bold uppercase px-3 mb-2 tracking-wider">ژانرها</h3>
          <div className="space-y-0.5">
            {GENRES.map((g) => (
              <button
                key={g.id}
                onClick={() => onGenreSelect(g.id)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/60 transition-all group w-full"
                style={{ color: '#2a4538' }}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                  style={{ 
                    backgroundColor: g.color,
                    boxShadow: `0 0 8px ${g.color}80`,
                  }}
                ></div>
                <span className="text-sm">{g.nameFa}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>
      
      <div 
        className="absolute bottom-0 left-0 right-0 p-3"
        style={{ borderTop: '1px solid rgba(2, 144, 72, 0.1)' }}
      >
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all w-full hover:bg-red-50"
          style={{ color: '#4a5d52' }}
        >
          <NavIcon name="exit" />
          <span className="font-medium text-sm">خروج</span>
        </button>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, JSX.Element> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
    reports: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    exit: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
  };
  return (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {icons[name] || icons.home}
    </svg>
  );
}

// ============================================
// DASHBOARD
// ============================================
function Dashboard({ onGenreClick }: { onGenreClick: (id: number) => void }) {
  const totalPrograms = GENRES.reduce((sum, g) => sum + g.count, 0);
  const stats = [
    { label: 'کل برنامه‌ها', value: totalPrograms, color: '#029048', icon: 'film' },
    { label: 'ژانرها', value: GENRES.length, color: '#2563eb', icon: 'tag' },
    { label: 'با تصویر', value: Math.floor(totalPrograms / 3), color: '#db2777', icon: 'image' },
    { label: 'بدون بیننده', value: Math.floor(totalPrograms * 0.7), color: '#d97706', icon: 'eye' },
  ];
  
  return (
    <>
      <header className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold" style={{ color: '#1a2e22' }}>داشبورد</h1>
          <span 
            className="text-sm px-3 py-1 rounded-full"
            style={{ background: 'rgba(2, 144, 72, 0.1)', color: '#016035' }}
          >
            بانک رسانه
          </span>
        </div>
        <p style={{ color: '#7a8a80' }}>به بانک رسانه خوش آمدید - مرور کلی برنامه‌ها</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="liquid-glass p-5 relative overflow-hidden">
            <div 
              className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-25"
              style={{ backgroundColor: s.color }}
            ></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: `${s.color}18`, 
                    color: s.color,
                    border: `1px solid ${s.color}30`,
                  }}
                >
                  <StatIcon name={s.icon} />
                </div>
                <span style={{ color: '#4a5d52' }} className="text-sm font-medium">{s.label}</span>
              </div>
              <div className="text-3xl font-black" style={{ color: '#1a2e22' }}>
                {s.value.toLocaleString('fa-IR')}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <section>
        <h2 className="text-xl font-bold mb-4" style={{ color: '#1a2e22' }}>ژانرها</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GENRES.map((g, idx) => (
            <button
              key={g.id}
              onClick={() => onGenreClick(g.id)}
              className={`liquid-glass genre-${g.id} block animate-slide-up p-5 text-right`}
              style={{ animationDelay: `${idx * 60}ms`, opacity: 0 }}
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div 
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
                    style={{ 
                      backgroundColor: `${g.color}18`, 
                      color: g.color,
                      border: `1px solid ${g.color}30`,
                      boxShadow: `0 4px 16px ${g.color}20`,
                    }}
                  >
                    {g.nameFa.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="text-4xl font-black" style={{ color: '#1a2e22' }}>
                      {g.count.toLocaleString('fa-IR')}
                    </div>
                    <div style={{ color: '#7a8a80' }} className="text-xs">برنامه</div>
                  </div>
                </div>
                <h3 className="font-bold text-lg mb-1" style={{ color: '#1a2e22' }}>{g.nameFa}</h3>
                <p style={{ color: '#7a8a80' }} className="text-xs">{g.name}</p>
                <p style={{ color: '#4a5d52' }} className="text-sm mt-3">{g.description}</p>
                <div className="mt-4 flex items-center text-sm font-medium" style={{ color: g.color }}>
                  مشاهده برنامه‌ها
                  <svg className="w-4 h-4 mr-1 rtl-flip" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </>
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

// ============================================
// PROGRAMS VIEW
// ============================================
function ProgramsView({ genreId }: { genreId?: number }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [filter, setFilter] = useState('all');
  
  let programs = genreId 
    ? ALL_PROGRAMS.filter(p => p.genre.id === genreId)
    : ALL_PROGRAMS;
  
  if (search) {
    programs = programs.filter(p => 
      p.title.includes(search) || p.description.includes(search)
    );
  }
  
  if (filter === 'with-images') programs = programs.filter(p => p.hasImages);
  if (filter === 'with-viewers') programs = programs.filter(p => p.viewersCount > 0);
  if (filter === 'without-viewers') programs = programs.filter(p => !p.viewersCount);
  
  const genre = genreId ? GENRES.find(g => g.id === genreId) : null;
  
  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: '#1a2e22' }}>
            {genre ? genre.nameFa : 'همهٔ برنامه‌ها'}
          </h1>
          <p style={{ color: '#7a8a80' }}>
            {programs.length.toLocaleString('fa-IR')} برنامه
          </p>
        </div>
      </header>
      
      {genre && (
        <div className="liquid-glass mb-6 p-6 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <div 
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black"
              style={{ 
                backgroundColor: `${genre.color}18`, 
                color: genre.color,
                border: `1px solid ${genre.color}30`,
                boxShadow: `0 4px 20px ${genre.color}30`,
              }}
            >
              {genre.nameFa.charAt(0)}
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1" style={{ color: '#1a2e22' }}>{genre.nameFa}</h2>
              <p style={{ color: '#7a8a80' }}>{genre.name} • {genre.count.toLocaleString('fa-IR')} برنامه</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="liquid-glass p-4 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <svg 
              className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: '#7a8a80' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو..."
              className="glass-input pr-10"
              style={{
                background: 'rgba(255, 255, 255, 0.6)',
                border: '1px solid rgba(2, 144, 72, 0.15)',
                borderRadius: '12px',
                padding: '10px 16px',
                width: '100%',
                fontFamily: 'inherit',
              }}
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
              className="p-2 rounded-lg transition-colors"
              style={view === 'grid' ? { background: '#029048', color: 'white' } : { color: '#4a5d52' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-lg transition-colors"
              style={view === 'list' ? { background: '#029048', color: 'white' } : { color: '#4a5d52' }}
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
              color: '#016035',
            } : {
              background: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(2, 144, 72, 0.15)',
              color: '#4a5d52',
            }}
          >
            {selectionMode ? '✓ حالت انتخاب' : 'انتخاب چندتایی'}
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <span style={{ color: '#7a8a80' }} className="text-sm ml-2">فیلتر:</span>
          {[
            { key: 'all', label: 'همه' },
            { key: 'without-viewers', label: 'بدون بیننده' },
            { key: 'with-viewers', label: 'با بیننده' },
            { key: 'with-images', label: 'با تصویر' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium"
              style={filter === f.key ? {
                background: 'linear-gradient(135deg, #029048 0%, #016035 100%)',
                color: 'white',
              } : {
                background: 'rgba(255, 255, 255, 0.5)',
                color: '#4a5d52',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        
        {selectionMode && (
          <div 
            className="flex items-center gap-3 pt-3"
            style={{ borderTop: '1px solid rgba(2, 144, 72, 0.1)' }}
          >
            <span style={{ color: '#016035' }} className="font-medium">
              {selectedIds.length.toLocaleString('fa-IR')} برنامه انتخاب شده
            </span>
          </div>
        )}
      </div>
      
      {programs.length === 0 ? (
        <div className="text-center py-20" style={{ color: '#7a8a80' }}>
          <p>برنامه‌ای یافت نشد</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {programs.slice(0, 48).map(p => (
            <ProgramCard 
              key={p.id} 
              program={p} 
              selectionMode={selectionMode}
              selected={selectedIds.includes(p.id)}
              onToggle={() => {
                if (selectedIds.includes(p.id)) {
                  setSelectedIds(selectedIds.filter(x => x !== p.id));
                } else {
                  setSelectedIds([...selectedIds, p.id]);
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {programs.slice(0, 48).map(p => (
            <ProgramListRow 
              key={p.id} 
              program={p} 
              selectionMode={selectionMode}
              selected={selectedIds.includes(p.id)}
              onToggle={() => {
                if (selectedIds.includes(p.id)) {
                  setSelectedIds(selectedIds.filter(x => x !== p.id));
                } else {
                  setSelectedIds([...selectedIds, p.id]);
                }
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function ProgramCard({ program, selectionMode, selected, onToggle }: any) {
  return (
    <div
      className={`liquid-glass cursor-pointer group overflow-hidden ${selected ? 'selected' : ''}`}
      onClick={selectionMode ? onToggle : undefined}
      style={selected ? {
        border: '2px solid #029048',
        background: 'rgba(2, 144, 72, 0.08)',
        boxShadow: '0 0 0 2px #029048, 0 8px 32px rgba(2, 144, 72, 0.2)',
      } : {}}
    >
      <div 
        className="aspect-video relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${program.genre.color}25 0%, ${program.genre.color}10 100%)`,
          borderRadius: '20px 20px 0 0',
        }}
      >
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 50%, ${program.genre.color}, transparent 60%)`,
          }}
        ></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black"
            style={{ 
              backgroundColor: `${program.genre.color}25`,
              color: program.genre.color,
              border: `1px solid ${program.genre.color}40`,
            }}
          >
            {program.genre.nameFa.charAt(0)}
          </div>
        </div>
        
        <div className="absolute top-2 right-2 flex gap-1">
          {program.hasImages && (
            <span 
              className="text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
              style={{ background: 'rgba(2, 144, 72, 0.85)', color: 'white' }}
            >
              تصویر
            </span>
          )}
        </div>
        
        {selectionMode && (
          <div 
            className="absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center"
            style={selected ? {
              background: '#029048',
              borderColor: '#029048',
            } : {
              background: 'rgba(255,255,255,0.7)',
              borderColor: 'rgba(2, 144, 72, 0.4)',
            }}
          >
            {selected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
        
        {program.duration && (
          <div 
            className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
            style={{ background: 'rgba(0, 0, 0, 0.7)', color: 'white' }}
          >
            {toFa(program.duration)} دقیقه
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ 
              backgroundColor: `${program.genre.color}18`,
              color: program.genre.color,
            }}
          >
            {program.genre.nameFa}
          </span>
          <span style={{ color: '#7a8a80' }} className="text-xs">#{toFa(program.id)}</span>
        </div>
        
        <h3 className="font-bold text-sm leading-snug mb-2 line-clamp-2" style={{ color: '#1a2e22' }}>
          {program.title}
        </h3>
        
        <p style={{ color: '#4a5d52' }} className="text-xs line-clamp-2 mb-3">
          {program.description}
        </p>
        
        <div className="flex items-center justify-between text-xs" style={{ color: '#4a5d52' }}>
          <span>👁 {toFa(program.viewersCount)}</span>
          <span>📺 {toFa(program.episodeCount)} قسمت</span>
          <span style={{ color: '#7a8a80' }} className="truncate max-w-[100px]">{program.producer}</span>
        </div>
      </div>
    </div>
  );
}

function ProgramListRow({ program, selectionMode, selected, onToggle }: any) {
  return (
    <div
      className="liquid-glass p-4 flex items-center gap-4 cursor-pointer"
      onClick={selectionMode ? onToggle : undefined}
      style={selected ? {
        border: '2px solid #029048',
        background: 'rgba(2, 144, 72, 0.08)',
      } : {}}
    >
      {selectionMode && (
        <div 
          className="w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0"
          style={selected ? {
            background: '#029048',
            borderColor: '#029048',
          } : {
            borderColor: 'rgba(2, 144, 72, 0.4)',
            background: 'rgba(255,255,255,0.4)',
          }}
        >
          {selected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      
      <div 
        className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ 
          background: `linear-gradient(135deg, ${program.genre.color}25, ${program.genre.color}10)`,
          border: `1px solid ${program.genre.color}30`,
        }}
      >
        <span className="text-2xl font-black" style={{ color: program.genre.color }}>
          {program.genre.nameFa.charAt(0)}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ 
              backgroundColor: `${program.genre.color}18`,
              color: program.genre.color,
            }}
          >
            {program.genre.nameFa}
          </span>
          <span style={{ color: '#7a8a80' }} className="text-xs">#{toFa(program.id)}</span>
        </div>
        <h3 className="font-bold text-sm mb-1 truncate" style={{ color: '#1a2e22' }}>{program.title}</h3>
        <p style={{ color: '#4a5d52' }} className="text-xs truncate">{program.description}</p>
      </div>
      
      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="text-center">
          <div style={{ color: '#7a8a80' }} className="text-xs">دقیقه</div>
          <div style={{ color: '#1a2e22' }} className="font-bold text-sm">{toFa(program.duration)}</div>
        </div>
        <div className="text-center">
          <div style={{ color: '#7a8a80' }} className="text-xs">بیننده</div>
          <div style={{ color: '#1a2e22' }} className="font-bold text-sm">{toFa(program.viewersCount)}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// GENRE VIEW (alias for ProgramsView with genreId)
// ============================================
function GenreView({ genreId }: { genreId: number }) {
  return <ProgramsView genreId={genreId} />;
}

// ============================================
// REPORTS VIEW
// ============================================
function ReportsView() {
  const reports = [
    { id: 1, title: 'گزارش کامل برنامه‌ها - آذر ۱۴۰۴', type: 'pdf', count: 587, date: '۱۴۰۴/۰۸/۲۳' },
    { id: 2, title: 'گزارش برنامه‌های دکور - مهر ۱۴۰۴', type: 'excel', count: 560, date: '۱۴۰۴/۰۷/۱۸' },
    { id: 3, title: 'گزارش برنامه‌های مستند', type: 'pdf', count: 6, date: '۱۴۰۴/۰۷/۱۳' },
    { id: 4, title: 'گزارش برنامه‌های بدون بیننده', type: 'excel', count: 412, date: '۱۴۰۴/۰۶/۲۹' },
  ];
  
  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1a2e22' }}>گزارش‌ها</h1>
          <p style={{ color: '#7a8a80' }}>تاریخچه خروجی‌های PDF و Excel</p>
        </div>
      </header>
      
      <div className="liquid-glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr style={{ 
              background: 'rgba(2, 144, 72, 0.06)',
              borderBottom: '1px solid rgba(2, 144, 72, 0.15)',
            }}>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#4a5d52' }}>#</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#4a5d52' }}>عنوان</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#4a5d52' }}>نوع</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#4a5d52' }}>تعداد</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#4a5d52' }}>تاریخ</th>
              <th className="text-right p-4 text-xs font-bold" style={{ color: '#4a5d52' }}>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r, idx) => (
              <tr 
                key={r.id} 
                className="transition-colors hover:bg-white/50"
                style={{ borderBottom: '1px solid rgba(2, 144, 72, 0.08)' }}
              >
                <td className="p-4 text-sm" style={{ color: '#7a8a80' }}>{(idx + 1).toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm font-medium" style={{ color: '#1a2e22' }}>{r.title}</td>
                <td className="p-4">
                  <span 
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                    style={r.type === 'pdf' 
                      ? { background: 'rgba(220, 38, 38, 0.15)', color: '#dc2626' }
                      : { background: 'rgba(2, 144, 72, 0.15)', color: '#016035' }
                    }
                  >
                    {r.type === 'pdf' ? 'PDF' : 'Excel'}
                  </span>
                </td>
                <td className="p-4 text-sm" style={{ color: '#4a5d52' }}>{r.count.toLocaleString('fa-IR')}</td>
                <td className="p-4 text-sm" style={{ color: '#7a8a80' }}>{r.date}</td>
                <td className="p-4">
                  <button className="text-sm hover:underline" style={{ color: '#029048' }}>مشاهده</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ============================================
// CODE VIEW (designer reference)
// ============================================
function CodeView({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      width: '100%',
      minHeight: '100vh',
      background: '#0d0d0d',
      padding: '40px',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: '13px',
      lineHeight: 1.7,
      direction: 'ltr',
      textAlign: 'left',
      color: '#aaa',
    }}>
      <button 
        onClick={onBack}
        style={{
          padding: '8px 16px',
          background: 'rgba(2, 144, 72, 0.2)',
          color: '#4ade80',
          border: '1px solid rgba(2, 144, 72, 0.3)',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '24px',
          fontFamily: 'inherit',
          fontSize: '13px',
        }}
      >
        ← بازگشت به برنامه
      </button>
      
      <h2 style={{ color: '#4ade80', marginBottom: '24px' }}>🎨 طراحی بانک رسانه v1.2.0</h2>
      
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#22c55e', marginBottom: '12px' }}>📁 ساختار پروژه</h3>
        <pre style={{ color: '#888' }}>{`banke-rasane/
├── electron/              # پروسه اصلی Electron
│   ├── main.js
│   └── preload.js
├── prisma/                # اسکیمای دیتابیس
│   └── schema.prisma
├── src/
│   ├── app/               # صفحات Next.js
│   │   ├── page.tsx       # صفحه ورود (تم سینمایی)
│   │   ├── dashboard/     # داشبورد + گزارش‌ها
│   │   ├── programs/      # همه برنامه‌ها
│   │   └── api/           # API routes
│   ├── components/        # کامپوننت‌های React
│   └── lib/               # utility ها
├── public/
│   ├── banke-rasane-logo.png  # لوگوی واقعی
│   └── fonts/             # فونت IRANSans/Vazirmatn
└── build/                 # آیکون و منابع`}</pre>
      </div>
      
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#22c55e', marginBottom: '12px' }}>🎨 پالت رنگ</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
          {[
            { name: 'brand-green', hex: '#029048', desc: 'سبز اصلی لوگو' },
            { name: 'brand-green-dark', hex: '#016035', desc: 'سبز تیره‌تر' },
            { name: 'cinema-bg-deep', hex: '#051910', desc: 'پس‌زمینه سینمایی' },
            { name: 'cinema-bg-mid', hex: '#0a2818', desc: 'میان‌تن سینمایی' },
            { name: 'cream-bg', hex: '#FAF6ED', desc: 'پس‌زمینه کرم محتوا' },
            { name: 'cream-bg-soft', hex: '#F5EFE0', desc: 'کرم نرم' },
            { name: 'cream-text', hex: '#1a2e22', desc: 'متن روی کرم' },
            { name: 'cream-text-soft', hex: '#4a5d52', desc: 'متن ثانویه' },
          ].map(c => (
            <div key={c.name} style={{
              background: '#1a1a1a',
              border: '1px solid #222',
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '6px',
                background: c.hex,
                border: '1px solid #333',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ color: '#fff', fontSize: '11px', fontWeight: 600 }}>{c.name}</div>
                <div style={{ color: '#888', fontSize: '10px' }}>{c.hex}</div>
                <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ color: '#22c55e', marginBottom: '12px' }}>✨ ویژگی‌های طراحی</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', lineHeight: 2 }}>
          <li><strong style={{ color: '#fff' }}>لوگوی واقعی:</strong> فایل banke-rasane-logo.png استفاده شده</li>
          <li><strong style={{ color: '#fff' }}>فونت IRANSans:</strong> با fallback به Vazirmatn (۸ وزن)</li>
          <li><strong style={{ color: '#fff' }}>صفحه ورود:</strong> تم سینمایی سبز با گرادینت نوری، ۳ منبع نوری متحرک</li>
          <li><strong style={{ color: '#fff' }}>محتوای داخل:</strong> پس‌زمینه کرم روشن #FAF6ED با بافت paper سبک</li>
          <li><strong style={{ color: '#fff' }}>کارت‌ها:</strong> Liquid Glass با backdrop-blur 16px + saturate 180%</li>
          <li><strong style={{ color: '#fff' }}>موشن لوگو:</strong> لوپ ۴ ثانیه‌ای light sweep + ۳ ثانیه glow pulse</li>
          <li><strong style={{ color: '#fff' }}>دکمه ورود:</strong> سبز با گرادینت #029048 → #027940، متن سفید، سایه سبز</li>
          <li><strong style={{ color: '#fff' }}>۹ ژانر:</strong> دکور(۵۶۰)، ریلیتی(۶)، مستند(۶)، خبری(۴)، مصاحبه(۰)، کودک(۳)، ورزشی(۲)، موسیقی(۳)، آموزشی(۳)</li>
          <li><strong style={{ color: '#fff' }}>تعداد کل:</strong> ۵۸۷ برنامه با جستجو، فیلتر، مرتب‌سازی</li>
        </ul>
      </div>
      
      <div>
        <h3 style={{ color: '#22c55e', marginBottom: '12px' }}>📐 Liquid Glass CSS</h3>
        <pre style={{ 
          background: '#0a0a0a',
          padding: '16px',
          borderRadius: '8px',
          border: '1px solid #222',
          color: '#22c55e',
          overflow: 'auto',
        }}>{`.liquid-glass {
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 
    0 8px 32px rgba(2, 144, 72, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  border-radius: 20px;
}`}</pre>
      </div>
    </div>
  );
}

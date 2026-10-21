'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import Image from 'next/image';

const navItems = [
  { href: '/dashboard', label: 'داشبورد', icon: 'home' },
  { href: '/programs', label: 'همهٔ برنامه‌ها', icon: 'grid' },
  { href: '/dashboard/reports', label: 'گزارش‌ها', icon: 'reports' },
];

const genres = [
  { id: 1, label: 'دکور برنامه‌ها', color: '#029048' },
  { id: 2, label: 'ریلیتی شو', color: '#dc2626' },
  { id: 3, label: 'مستندها', color: '#2563eb' },
  { id: 4, label: 'برنامه‌های خبری', color: '#d97706' },
  { id: 5, label: 'مصاحبه‌ها', color: '#7c3aed' },
  { id: 6, label: 'برنامه‌های کودک', color: '#db2777' },
  { id: 7, label: 'ورزشی', color: '#0d9488' },
  { id: 8, label: 'موسیقی و کنسرت', color: '#ea580c' },
  { id: 9, label: 'آموزشی', color: '#4f46e5' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <aside 
      className={`fixed right-0 top-0 h-screen transition-all duration-300 z-40 ${collapsed ? 'w-20' : 'w-72'}`}
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderLeft: '1px solid rgba(2, 144, 72, 0.15)',
        boxShadow: '-4px 0 24px rgba(2, 144, 72, 0.06)',
      }}
    >
      {/* Logo header */}
      <div 
        className="p-5 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(2, 144, 72, 0.1)' }}
      >
        <Link href="/dashboard" className="flex items-center gap-3">
          {!collapsed ? (
            <div className="flex items-center gap-2">
              <Image
                src="/banke-rasane-logo.png"
                alt="بانک رسانه"
                width={120}
                height={32}
                priority
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
              <Image
                src="/banke-rasane-logo.png"
                alt="بانک رسانه"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-ink-500 hover:text-brand-600 p-1 transition-colors"
        >
          <svg className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      {/* Navigation */}
      <nav className="p-3">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'text-brand-700'
                    : 'text-ink-700 hover:text-brand-600'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, rgba(2, 144, 72, 0.12) 0%, rgba(2, 144, 72, 0.06) 100%)',
                  border: '1px solid rgba(2, 144, 72, 0.2)',
                } : {
                  border: '1px solid transparent',
                }}
              >
                <NavIcon name={item.icon} />
                {!collapsed && <span className="font-medium text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </div>
        
        {/* Genres section */}
        {!collapsed && (
          <div className="mt-6">
            <h3 className="text-ink-500 text-xs font-bold uppercase px-3 mb-2 tracking-wider">ژانرها</h3>
            <div className="space-y-0.5">
              {genres.map((g) => (
                <Link
                  key={g.id}
                  href={`/genre/${g.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-ink-700 hover:bg-white/60 transition-all group"
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                    style={{ 
                      backgroundColor: g.color,
                      boxShadow: `0 0 8px ${g.color}80`,
                    }}
                  ></div>
                  <span className="text-sm">{g.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      
      {/* User info / exit */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-3"
        style={{ borderTop: '1px solid rgba(2, 144, 72, 0.1)' }}
      >
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-ink-600 hover:bg-red-50 hover:text-red-600 transition-all"
        >
          <NavIcon name="exit" />
          {!collapsed && <span className="font-medium text-sm">خروج</span>}
        </Link>
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

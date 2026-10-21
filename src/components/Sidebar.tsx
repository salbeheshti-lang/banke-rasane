'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/dashboard', label: 'داشبورد', icon: 'home' },
  { href: '/programs', label: 'همهٔ برنامه‌ها', icon: 'grid' },
  { href: '/dashboard/reports', label: 'گزارش‌ها', icon: 'reports' },
];

const genres = [
  { id: 1, label: 'دکور برنامه‌ها', color: '#22c55e' },
  { id: 2, label: 'ریلیتی شو', color: '#ef4444' },
  { id: 3, label: 'مستندها', color: '#3b82f6' },
  { id: 4, label: 'برنامه‌های خبری', color: '#f59e0b' },
  { id: 5, label: 'مصاحبه‌ها', color: '#8b5cf6' },
  { id: 6, label: 'برنامه‌های کودک', color: '#ec4899' },
  { id: 7, label: 'ورزشی', color: '#14b8a6' },
  { id: 8, label: 'موسیقی و کنسرت', color: '#f97316' },
  { id: 9, label: 'آموزشی', color: '#6366f1' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <aside className={`fixed right-0 top-0 h-screen bg-dark-900 border-l border-dark-700 transition-all duration-300 z-40 ${collapsed ? 'w-20' : 'w-72'}`}>
      {/* Logo */}
      <div className="p-5 border-b border-dark-700 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cinema-400 to-cinema-700 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">بانک رسانه</h1>
              <p className="text-gray-500 text-xs">Bank Rasane v1.1</p>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 hover:text-white p-1"
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
                    ? 'bg-cinema-600/20 text-cinema-400 border border-cinema-600/30'
                    : 'text-gray-400 hover:bg-dark-800 hover:text-white'
                }`}
              >
                <NavIcon name={item.icon} />
                {!collapsed && <span className="font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </div>
        
        {/* Genres section */}
        {!collapsed && (
          <div className="mt-6">
            <h3 className="text-gray-600 text-xs font-bold uppercase px-3 mb-2">ژانرها</h3>
            <div className="space-y-1">
              {genres.map((g) => (
                <Link
                  key={g.id}
                  href={`/genre/${g.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-dark-800 hover:text-white transition-all group"
                >
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0 group-hover:scale-125 transition-transform"
                    style={{ backgroundColor: g.color }}
                  ></div>
                  <span className="text-sm">{g.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>
      
      {/* User info / exit */}
      <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-dark-700">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
        >
          <NavIcon name="exit" />
          {!collapsed && <span className="font-medium">خروج</span>}
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

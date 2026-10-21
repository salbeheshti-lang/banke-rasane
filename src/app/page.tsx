'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('1.1.0');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);
    // Get app version from Electron
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getVersion) {
      (window as any).electronAPI.getVersion().then((v: string) => setAppVersion(v));
    }
  }, []);

  const handleEnter = async () => {
    setLoading(true);
    // Simulate brief loading for the cinematic effect
    await new Promise(r => setTimeout(r, 600));
    router.push('/dashboard');
  };

  return (
    <div className="login-bg min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Ambient lighting effects */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 login-glow pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 login-glow pointer-events-none" style={{ opacity: 0.6 }}></div>
      
      {/* Decorative grid */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(34, 197, 94, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      ></div>

      {/* Main content */}
      <div className={`relative z-10 text-center px-8 transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <div className="relative">
            {/* Glowing background */}
            <div className="absolute inset-0 blur-3xl bg-cinema-500/30 rounded-full"></div>
            
            {/* Logo container */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center pulse-glow rounded-full">
              <svg 
                viewBox="0 0 120 120" 
                className="w-28 h-28"
                style={{ filter: 'drop-shadow(0 4px 12px rgba(34, 197, 94, 0.4))' }}
              >
                <defs>
                  <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="50%" stopColor="#22c55e" />
                    <stop offset="100%" stopColor="#16a34a" />
                  </linearGradient>
                  <linearGradient id="logoGradDark" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#15803d" />
                    <stop offset="100%" stopColor="#052e16" />
                  </linearGradient>
                </defs>
                
                {/* Outer ring */}
                <circle cx="60" cy="60" r="56" fill="none" stroke="url(#logoGrad)" strokeWidth="2" opacity="0.5" />
                <circle cx="60" cy="60" r="50" fill="url(#logoGradDark)" stroke="url(#logoGrad)" strokeWidth="2" />
                
                {/* TV/Play icon */}
                <path 
                  d="M 45 40 L 45 80 L 80 60 Z" 
                  fill="url(#logoGrad)"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.6))' }}
                />
                
                {/* Filmstrip details */}
                <rect x="35" y="35" width="2" height="50" fill="url(#logoGrad)" opacity="0.6" />
                <rect x="83" y="35" width="2" height="50" fill="url(#logoGrad)" opacity="0.6" />
                
                {/* Center text - simplified "ب ر" */}
                <text 
                  x="60" 
                  y="100" 
                  textAnchor="middle" 
                  fontSize="11" 
                  fontWeight="bold" 
                  fill="url(#logoGrad)"
                  fontFamily="Vazirmatn, Tahoma, sans-serif"
                >
                  بانک رسانه
                </text>
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 
          className="text-6xl font-black mb-3 bg-gradient-to-b from-white via-cinema-100 to-cinema-400 bg-clip-text text-transparent"
          style={{ textShadow: '0 4px 20px rgba(34, 197, 94, 0.3)' }}
        >
          بانک رسانه
        </h1>
        
        <p className="text-cinema-300/70 text-lg mb-2 font-medium">
          BANK RASANE
        </p>
        
        <p className="text-gray-500 text-sm mb-12 max-w-md mx-auto leading-relaxed">
          نرم‌افزار جامع مدیریت برنامه‌های تلویزیونی
          <br />
          با ۵۸۷ برنامه در ۹ ژانر مختلف
        </p>

        {/* Enter button */}
        <button
          onClick={handleEnter}
          disabled={loading}
          className="group relative px-12 py-4 bg-white text-black font-bold text-lg rounded-full overflow-hidden transition-all duration-300 hover:scale-105 disabled:opacity-70"
          style={{ 
            boxShadow: '0 0 30px rgba(255, 255, 255, 0.3), 0 0 60px rgba(34, 197, 94, 0.2)',
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
          }}
        >
          <span className="relative z-10 flex items-center gap-3">
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                در حال ورود...
              </>
            ) : (
              <>
                ورود به برنامه
                <svg className="w-5 h-5 rtl-flip group-hover:translate-x-[-4px] transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </>
            )}
          </span>
          
          {/* Shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cinema-300/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </button>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <p className="text-gray-600 text-xs">
            نسخه {appVersion} • © 2026 salbeheshti-lang
          </p>
        </div>
      </div>
    </div>
  );
}

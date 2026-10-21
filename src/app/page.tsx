'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [appVersion, setAppVersion] = useState('1.2.0');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    document.body.classList.add('login-screen');
    document.body.classList.remove('app-content');
    setIsReady(true);
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getVersion) {
      (window as any).electronAPI.getVersion().then((v: string) => setAppVersion(v));
    }
    return () => {
      document.body.classList.remove('login-screen');
    };
  }, []);

  const handleEnter = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    router.push('/dashboard');
  };

  return (
    <div className="login-screen min-h-screen relative flex items-center justify-center">
      {/* Ambient green lighting effects */}
      <div className="login-ambient-light green-1"></div>
      <div className="login-ambient-light green-2"></div>
      <div className="login-ambient-light green-3"></div>
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(74, 222, 128, 1) 1px, transparent 1px), linear-gradient(90deg, rgba(74, 222, 128, 1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          zIndex: 1,
        }}
      ></div>
      
      {/* Film strip accent on the edges */}
      <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-green-500 to-transparent opacity-40 z-10"></div>
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-green-500 to-transparent opacity-40 z-10"></div>

      {/* Main content */}
      <div 
        className={`relative z-20 text-center px-8 transition-all duration-1000 ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        style={{ maxWidth: '900px' }}
      >
        {/* Logo with motion */}
        <div className="mb-10 flex justify-center">
          <div className="logo-motion logo-glow">
            <div className="relative">
              {/* Glowing background halo */}
              <div 
                className="absolute inset-0 blur-3xl rounded-full"
                style={{ 
                  background: 'radial-gradient(circle, rgba(2, 144, 72, 0.6) 0%, transparent 70%)',
                  transform: 'scale(1.2)',
                }}
              ></div>
              
              {/* Actual logo image */}
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
          onClick={handleEnter}
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
          
          {/* Shimmer effect */}
          <div 
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)',
              animation: 'logo-sweep 2s ease-in-out infinite',
            }}
          ></div>
        </button>

        {/* Footer */}
        <div className="absolute bottom-8 left-0 right-0 text-center z-20">
          <p style={{ color: 'rgba(168, 230, 193, 0.5)' }} className="text-xs tracking-wider">
            نسخه {appVersion} • © 2026 salbeheshti-lang
          </p>
        </div>
      </div>
    </div>
  );
}

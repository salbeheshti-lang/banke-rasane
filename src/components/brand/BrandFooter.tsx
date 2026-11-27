'use client';

import Image from 'next/image';
import { useLang } from '@/lib/i18n-context';
import { CLIENT_BRANDING } from '@/lib/branding';

/**
 * BrandFooter — sticky footer shown on every page.
 *
 * Layout: a single row with the BankResaneh mark on the right (RTL start)
 * and the organization logo on the left (RTL end),
 * separated by a thin vertical divider. Designed to fit the app's emerald
 * dark theme and to stick to the bottom of the viewport on short pages
 * while being pushed down naturally on long pages.
 *
 * The parent page should wrap content in `min-h-screen flex flex-col`
 * and render <BrandFooter /> as the last child (it applies `mt-auto` itself
 * so it sticks to the bottom).
 */
export function BrandFooter({ variant = 'dark', withBottomNav = false }: { variant?: 'dark' | 'light' | 'compact' | 'login'; withBottomNav?: boolean }) {
  const { t } = useLang();
  const currentYear = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date());

  const isLight = variant === 'light';
  const isCompact = variant === 'compact';
  const isLogin = variant === 'login';

  const bg = isLight
    ? 'rgba(248, 250, 252, 0.92)'
    : 'linear-gradient(180deg, rgba(6,41,32,0.85) 0%, rgba(4,28,22,0.95) 100%)';
  const borderColor = isLight ? 'rgba(13,124,74,0.18)' : 'rgba(84,217,192,0.18)';
  const textColor = isLight ? '#0f3d2e' : '#a7f3d0';
  const subTextColor = isLight ? 'rgba(15,61,46,0.7)' : 'rgba(167,243,208,0.7)';
  const dividerColor = isLight ? 'rgba(13,124,74,0.2)' : 'rgba(84,217,192,0.2)';

  return (
    <footer
      dir="rtl"
      style={{
        marginTop: 'auto',
        width: '100%',
        background: isLogin ? 'transparent' : bg,
        borderTop: isLogin ? 'none' : `1px solid ${borderColor}`,
        backdropFilter: isLogin ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: isLogin ? 'none' : 'blur(8px)',
        padding: isLogin ? '1rem 1rem calc(1rem + env(safe-area-inset-bottom))' : isCompact ? '0.6rem 1rem' : '0.9rem 1.25rem',
        zIndex: 30,
        paddingBottom: isLogin ? 'calc(1rem + env(safe-area-inset-bottom))' : withBottomNav ? 'calc(84px + env(safe-area-inset-bottom))' : 'max(0.6rem, env(safe-area-inset-bottom))',
      }}
    >
      {isLogin ? (
        <div
          style={{
            maxWidth: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 'min(100%, 340px)',
            gap: '0.35rem',
            textAlign: 'center',
          }}
        >
          <Image
            src={CLIENT_BRANDING.logoWhitePath}
            alt={CLIENT_BRANDING.organizationFa}
            width={88}
            height={88}
            priority
            style={{
              display: 'block',
              width: 'clamp(64px, 7vw, 82px)',
              height: 'clamp(64px, 7vw, 82px)',
              objectFit: 'contain',
              opacity: 1,
              margin: '0 auto',
            }}
          />
          <span
            style={{
              display: 'block',
              width: '100%',
              color: '#ecfff7',
              fontSize: 'clamp(0.82rem, 1.1vw, 0.98rem)',
              fontWeight: 700,
              lineHeight: 1.8,
              letterSpacing: '0',
              whiteSpace: 'normal',
              textWrap: 'balance',
              textAlign: 'center',
              textShadow: '0 1px 8px rgba(0,0,0,0.45)',
            }}
          >
            {CLIENT_BRANDING.organizationFa}
          </span>
        </div>
      ) : (
      <div
        className="flex flex-col sm:flex-row items-center justify-between"
        data-testid="app-brand-footer"
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Right side (RTL start): BankResaneh mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Image
            src="/banke-rasane-logo.png"
            alt={t('app.title')}
            width={isCompact ? 90 : 110}
            height={isCompact ? 24 : 30}
            style={{ filter: isLight ? 'none' : 'brightness(1.1) saturate(1.1)' }}
          />
          {!isCompact && (
            <span style={{ color: subTextColor, fontSize: '0.7rem', fontWeight: 500 }}>
              {t('footer.copyright').replace('{year}', currentYear)}
            </span>
          )}
        </div>

        {/* Center divider */}
        <div
          className="w-10 h-px sm:w-px sm:h-7"
          aria-hidden="true"
          style={{
            background: dividerColor,
            flexShrink: 0,
          }}
        />

        {/* Organization identity: the official name sits directly below its logo. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.28rem',
            minWidth: isCompact ? '112px' : '180px',
          }}
        >
          <Image
            src={isLight ? CLIENT_BRANDING.logoColorPath : CLIENT_BRANDING.logoWhitePath}
            alt={CLIENT_BRANDING.organizationFa}
            width={isCompact ? 34 : 48}
            height={isCompact ? 34 : 48}
            style={{
              display: 'block',
              opacity: isLight ? 1 : 1,
              objectFit: 'contain',
            }}
          />
          <span
            className="footer-client-text"
            style={{
              display: 'block',
              color: textColor,
              fontSize: isCompact ? '0.62rem' : '0.76rem',
              fontWeight: 700,
              lineHeight: 1.65,
              textAlign: 'center',
              whiteSpace: 'normal',
              textWrap: 'balance',
              maxWidth: isCompact ? '132px' : '220px',
            }}
          >
            {CLIENT_BRANDING.organizationFa}
          </span>
        </div>
      </div>
      )}
    </footer>
  );
}

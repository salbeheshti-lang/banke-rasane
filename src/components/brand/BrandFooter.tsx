'use client';

import Image from 'next/image';
import { useLang } from '@/lib/i18n-context';
import { CLIENT_BRANDING } from '@/lib/branding';

/**
 * BrandFooter — sticky footer shown on every page.
 *
 * Layout: a single row with the BankResaneh mark on the right (RTL start)
 * and the client logo (مؤسسه فرهنگی هنری مرکز عروج منیر) on the left (RTL end),
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
            gap: '0.55rem',
            textAlign: 'center',
          }}
        >
          <Image
            src={CLIENT_BRANDING.logoWhitePath}
            alt={CLIENT_BRANDING.organizationFa}
            width={60}
            height={60}
            priority
            style={{
              width: 'clamp(42px, 5vw, 58px)',
              height: 'clamp(42px, 5vw, 58px)',
              objectFit: 'contain',
              opacity: 0.96,
            }}
          />
          <span
            style={{
              color: 'rgba(226, 255, 244, 0.9)',
              fontSize: 'clamp(0.72rem, 1.05vw, 0.875rem)',
              fontWeight: 600,
              lineHeight: 1.6,
              letterSpacing: '0',
              whiteSpace: 'normal',
              textWrap: 'balance',
            }}
          >
            {CLIENT_BRANDING.organizationFa}
          </span>
        </div>
      ) : (
      <div
        style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          style={{
            width: '1px',
            height: isCompact ? '20px' : '28px',
            background: dividerColor,
            flexShrink: 0,
          }}
        />

        {/* Organization identity: show only the official organization name
            beside its logo. Never prepend a commissioning/attribution label. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isCompact && (
            <div
              className="footer-client-text"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                lineHeight: 1.25,
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  color: subTextColor,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  marginTop: 0,
                }}
              >
                {t('footer.clientOrg')}
              </span>
            </div>
          )}
          {/* Client logo — true transparency, no backing box. On the dark
              theme we use the white knockout variant (client-logo-white.png)
              so the mark stays readable directly on the dark footer; on the
              light theme the original navy transparent PNG is used. Dimensions
              follow the logo's native ~square aspect ratio. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Image
              src={isLight ? CLIENT_BRANDING.logoColorPath : CLIENT_BRANDING.logoWhitePath}
              alt={CLIENT_BRANDING.organizationFa}
              width={isCompact ? 27 : 39}
              height={isCompact ? 28 : 40}
              style={{
                opacity: isLight ? 1 : 0.92,
                objectFit: 'contain',
              }}
            />
          </div>
        </div>
      </div>
      )}
    </footer>
  );
}

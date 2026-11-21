'use client';

import Image from 'next/image';
import { useLang } from '@/lib/i18n-context';

/**
 * BrandFooter — sticky footer shown on every page.
 *
 * Variants:
 *  - 'dark'    (default): full co-branded footer — BankResaneh mark +
 *               divider + client logo with org-name label.
 *  - 'light':  same as 'dark' but on a light background.
 *  - 'compact': condensed single-row footer for narrow chrome (drawer,
 *               modals). Hides the org-name label.
 *  - 'login':  login-screen footer — ONLY the client logo + org name
 *               centered, no BankResaneh mark, no "تهیه‌شده برای" label.
 *               Designed to be elegant and minimal on both mobile and
 *               desktop login screens.
 *
 * The parent page should wrap content in `min-h-screen flex flex-col`
 * and render <BrandFooter /> as the last child (it applies `mt-auto` itself
 * so it sticks to the bottom).
 */
export function BrandFooter({ variant = 'dark' }: { variant?: 'dark' | 'light' | 'compact' | 'login' }) {
  const { t } = useLang();

  const isLight = variant === 'light';
  const isCompact = variant === 'compact';
  const isLogin = variant === 'login';

  // ─────────────────────────────────────────────────────────────────────
  // LOGIN VARIANT — minimal, centered, elegant.
  // Shows ONLY the client logo with the org name centered beneath it.
  // No BankResaneh mark, no "تهیه‌شده برای" label, no divider.
  // Logo size (56×56 CSS px) tuned to be readable on both mobile (375px)
  // and desktop (1440px) — large enough to read, small enough not to
  // dominate the login screen.
  // ─────────────────────────────────────────────────────────────────────
  if (isLogin) {
    return (
      <footer
        dir="rtl"
        style={{
          marginTop: 'auto',
          background: 'transparent',
          borderTop: 'none',
          padding: '1.5rem 1rem 1.25rem',
          zIndex: 30,
          paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            margin: '0 auto',
          }}
        >
          <Image
            src="/client-logo-white.png"
            alt="مانیتورینگ مرکز طرح و برنامه سیما"
            width={56}
            height={56}
            priority
            style={{
              objectFit: 'contain',
              opacity: 1,
              // Subtle glow so the white knockout mark reads cleanly on
              // the dark login backdrop without a backing box.
              filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.3)) brightness(1.05)',
            }}
          />
          <span
            style={{
              color: 'rgba(220, 252, 231, 0.95)',
              fontSize: '0.82rem',
              fontWeight: 600,
              letterSpacing: '0.01em',
              lineHeight: 1.4,
              textAlign: 'center',
              maxWidth: '20rem',
            }}
          >
            {t('footer.clientOrg')}
          </span>
        </div>
      </footer>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // DEFAULT / DARK / LIGHT / COMPACT VARIANT — full co-branded footer.
  // ─────────────────────────────────────────────────────────────────────
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
        background: bg,
        borderTop: `1px solid ${borderColor}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: isCompact ? '0.6rem 1rem' : '0.9rem 1.25rem',
        zIndex: 30,
        paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))',
      }}
    >
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
              {t('footer.copyright')}
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

        {/* Left side (RTL end): Client logo + label + organization name */}
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
              <span style={{ color: textColor, fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.02em' }}>
                {t('footer.poweredBy')}
              </span>
              <span
                style={{
                  color: subTextColor,
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  marginTop: '1px',
                }}
              >
                {t('footer.clientOrg')}
              </span>
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Image
              src={isLight ? '/client-logo.png' : '/client-logo-white.png'}
              alt="مؤسسه فرهنگی هنری مرکز عروج منیر"
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
    </footer>
  );
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'بانک رسانه',
    short_name: 'بانک رسانه',
    description: 'آرشیو تخصصی برنامه‌های تلویزیونی',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: '#071f17',
    theme_color: '#075b3b',
    orientation: 'any',
    icons: [
      { src: '/icons/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-256.png', sizes: '256x256', type: 'image/png', purpose: 'any' },
    ],
  };
}

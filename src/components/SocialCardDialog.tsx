'use client';

import { useState, useEffect, useRef } from 'react';

interface SocialCardDialogProps {
  programIds: number[];
  onClose: () => void;
}

const PLATFORMS = [
  { id: 'telegram', name: 'تلگرام', color: '#0088cc', icon: 'M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z' },
  { id: 'bale', name: 'بله', color: '#ffaa00', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' },
  { id: 'ita', name: 'ایفا', color: '#3b82f6', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { id: 'soroush', name: 'سروش', color: '#f97316', icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' },
  { id: 'gap', name: 'گپ', color: '#22c55e', icon: 'M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' },
  { id: 'instagram', name: 'اینستاگرام', color: '#e1306c', icon: 'M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z' },
  { id: 'twitter', name: 'توییتر', color: '#1da1f2', icon: 'M23.95 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.564-2.005.974-3.127 1.195a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.868 9.868 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z' },
  { id: 'whatsapp', name: 'واتساپ', color: '#25d366', icon: 'M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.515 5.26l-.999 3.648 3.973-1.041zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z' },
];

export default function SocialCardDialog({ programIds, onClose }: SocialCardDialogProps) {
  const [platform, setPlatform] = useState('telegram');
  const [data, setData] = useState<{ postText: string; cardData: any; platform: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/social-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ programIds, platform }),
        });
        if (!res.ok) throw new Error('Failed to load');
        const d = await res.json();
        setData(d);
        
        // Generate card image
        generateCardImage(d.cardData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [programIds, platform]);
  
  const generateCardImage = (cardData: any) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const size = 1080;
    canvas.width = size;
    canvas.height = size;
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#0a0a0a');
    gradient.addColorStop(0.5, '#0f1f0f');
    gradient.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Platform accent color glow (top right)
    const platformColor = cardData.background;
    const radialGrad = ctx.createRadialGradient(size - 200, 200, 0, size - 200, 200, 600);
    radialGrad.addColorStop(0, platformColor + '40');
    radialGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, size, size);
    
    // Top branding bar
    ctx.fillStyle = platformColor;
    ctx.fillRect(0, 0, size, 8);
    
    // Logo circle (top right)
    ctx.beginPath();
    ctx.arc(size - 100, 100, 50, 0, 2 * Math.PI);
    ctx.fillStyle = platformColor + '20';
    ctx.fill();
    ctx.strokeStyle = platformColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Play icon inside
    ctx.fillStyle = platformColor;
    ctx.beginPath();
    ctx.moveTo(size - 115, 80);
    ctx.lineTo(size - 115, 120);
    ctx.lineTo(size - 80, 100);
    ctx.closePath();
    ctx.fill();
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    
    const title = cardData.title || '';
    const lines = wrapText(ctx, title, size - 200);
    let y = 300;
    lines.slice(0, 3).forEach((line: string) => {
      ctx.fillText(line, size - 100, y);
      y += 70;
    });
    
    // Subtitle
    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 36px Vazirmatn, Tahoma, sans-serif';
    ctx.fillText(cardData.subtitle || 'بانک رسانه', size - 100, y + 30);
    
    // Genre tag
    if (cardData.genre) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px Vazirmatn, Tahoma, sans-serif';
      ctx.fillText(`#${cardData.genre}`, size - 100, y + 80);
    }
    
    // Programs list (bottom)
    if (cardData.programs && cardData.programs.length > 0) {
      y = 700;
      ctx.font = 'bold 32px Vazirmatn, Tahoma, sans-serif';
      ctx.fillStyle = '#a1a1aa';
      ctx.fillText('برنامه‌های منتخب:', size - 100, y);
      
      y += 50;
      ctx.font = '28px Vazirmatn, Tahoma, sans-serif';
      cardData.programs.slice(0, 5).forEach((p: any, idx: number) => {
        if (y > size - 100) return;
        ctx.fillStyle = p.color || '#22c55e';
        ctx.fillText('●', size - 100, y);
        ctx.fillStyle = '#ffffff';
        const t = p.title.length > 35 ? p.title.substring(0, 35) + '...' : p.title;
        ctx.fillText(t, size - 130, y);
        y += 40;
      });
    }
    
    // Bottom branding
    ctx.fillStyle = '#525252';
    ctx.font = '24px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Bank Rasane v1.1.0', 60, size - 50);
    
    ctx.textAlign = 'right';
    ctx.fillText(cardData.platform?.name || '', size - 60, size - 50);
    
    // Get image URL
    setCardImageUrl(canvas.toDataURL('image/png'));
  };
  
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };
  
  const copyText = async () => {
    if (!data?.postText) return;
    try {
      await navigator.clipboard.writeText(data.postText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Copy failed', e);
    }
  };
  
  const downloadCard = () => {
    if (!cardImageUrl) return;
    const a = document.createElement('a');
    a.href = cardImageUrl;
    a.download = `social-card-${platform}-${Date.now()}.png`;
    a.click();
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-dark-800 rounded-2xl border border-dark-600 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-700">
          <h3 className="text-white font-bold">کارت شبکه اجتماعی (۱۰۸۰×۱۰۸۰)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Card preview */}
          <div className="flex-1 bg-dark-900 p-4 overflow-auto flex items-center justify-center">
            {loading ? (
              <div className="spinner"></div>
            ) : cardImageUrl ? (
              <img 
                src={cardImageUrl} 
                alt="Social Card" 
                className="max-w-full max-h-full rounded-xl shadow-2xl"
                style={{ aspectRatio: '1/1', objectFit: 'contain' }}
              />
            ) : (
              <p className="text-gray-500">خطا در تولید کارت</p>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </div>
          
          {/* Right: Controls */}
          <div className="w-80 border-r border-dark-700 p-4 overflow-y-auto">
            {/* Platform selector */}
            <label className="text-gray-400 text-sm block mb-2">پلتفرم مقصد:</label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  className={`p-2 rounded-lg transition-all ${
                    platform === p.id 
                      ? 'bg-cinema-600/20 border border-cinema-600' 
                      : 'border border-dark-600 hover:border-dark-500'
                  }`}
                  title={p.name}
                >
                  <svg 
                    className="w-6 h-6 mx-auto" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                    style={{ color: p.color }}
                  >
                    <path d={p.icon} />
                  </svg>
                  <span className="text-xs text-gray-400 mt-1 block">{p.name}</span>
                </button>
              ))}
            </div>
            
            {/* Post text */}
            <label className="text-gray-400 text-sm block mb-2">متن پست:</label>
            <textarea
              value={data?.postText || ''}
              readOnly
              className="cinema-input w-full h-48 text-sm resize-none font-mono"
              placeholder="متن پست..."
            />
            
            <div className="flex gap-2 mt-3">
              <button
                onClick={copyText}
                className="cinema-button flex-1 text-sm"
              >
                {copied ? '✓ کپی شد' : 'کپی متن'}
              </button>
              <button
                onClick={downloadCard}
                className="cinema-button-secondary text-sm"
                disabled={!cardImageUrl}
              >
                دانلود کارت
              </button>
            </div>
            
            <div className="mt-4 p-3 bg-dark-900 rounded-lg text-xs text-gray-500">
              <p className="font-bold text-gray-400 mb-1">اطلاعات:</p>
              <p>تعداد برنامه‌ها: {programIds.length.toLocaleString('fa-IR')}</p>
              <p>پلتفرم: {PLATFORMS.find(p => p.id === platform)?.name}</p>
              <p>حداکثر کاراکتر: {data?.platform?.maxSize.toLocaleString('fa-IR')}</p>
              <p>طول متن: {(data?.postText?.length || 0).toLocaleString('fa-IR')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

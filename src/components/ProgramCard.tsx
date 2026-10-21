'use client';

interface Program {
  id: number;
  title: string;
  titleEn: string | null;
  description: string | null;
  duration: number | null;
  episodeCount: number | null;
  viewersCount: number | null;
  hasImages: boolean;
  hasVideo: boolean;
  status: string;
  producer: string | null;
  director: string | null;
  presenter: string | null;
  channel: string | null;
  airDate: string | null;
  genre: { id: number; name: string; nameFa: string; color: string };
}

function toFa(n: number | null | undefined): string {
  if (n === null || n === undefined || n === 0) return '-';
  return n.toLocaleString('fa-IR');
}

export default function ProgramCard({
  program,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  program: Program;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div
      className={`liquid-glass program-card cursor-pointer group overflow-hidden ${selected ? 'selected' : ''}`}
      onClick={selectionMode ? onToggleSelect : undefined}
      style={{ padding: 0 }}
    >
      {/* Thumbnail / Image area */}
      <div 
        className="aspect-video relative overflow-hidden"
        style={{ 
          background: `linear-gradient(135deg, ${program.genre.color}25 0%, ${program.genre.color}10 100%)`,
        }}
      >
        {/* Decorative pattern */}
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: `radial-gradient(circle at 30% 50%, ${program.genre.color}, transparent 60%)`,
          }}
        ></div>
        
        {/* Genre icon */}
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
        
        {/* Status badges */}
        <div className="absolute top-2 right-2 flex gap-1">
          {program.hasImages && (
            <span 
              className="text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
              style={{ 
                background: 'rgba(2, 144, 72, 0.85)', 
                color: 'white' 
              }}
            >
              تصویر
            </span>
          )}
          {program.hasVideo && (
            <span 
              className="text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
              style={{ 
                background: 'rgba(37, 99, 235, 0.85)', 
                color: 'white' 
              }}
            >
              ویدیو
            </span>
          )}
        </div>
        
        {/* Selection checkbox */}
        {selectionMode && (
          <div 
            className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
              selected ? 'bg-brand-500 border-brand-500' : 'bg-white/70 border-brand-500/40'
            }`}
          >
            {selected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        )}
        
        {/* Duration badge */}
        {program.duration && (
          <div 
            className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded-md backdrop-blur font-medium"
            style={{ 
              background: 'rgba(0, 0, 0, 0.7)', 
              color: 'white' 
            }}
          >
            {toFa(program.duration)} دقیقه
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Genre badge */}
        <div className="flex items-center gap-2 mb-2">
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ 
              backgroundColor: `${program.genre.color}18`,
              color: program.genre.color,
              border: `1px solid ${program.genre.color}30`,
            }}
          >
            {program.genre.nameFa}
          </span>
          <span style={{ color: 'var(--cream-text-muted)' }} className="text-xs">#{toFa(program.id)}</span>
        </div>
        
        {/* Title */}
        <h3 
          className="font-bold text-sm leading-snug mb-2 line-clamp-2 transition-colors"
          style={{ color: 'var(--cream-text)' }}
        >
          <span className="group-hover:text-brand-600 transition-colors">{program.title}</span>
        </h3>
        
        {/* Description */}
        {program.description && (
          <p style={{ color: 'var(--cream-text-soft)' }} className="text-xs line-clamp-2 mb-3">
            {program.description}
          </p>
        )}
        
        {/* Stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3" style={{ color: 'var(--cream-text-soft)' }}>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {toFa(program.viewersCount)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
              {toFa(program.episodeCount)} قسمت
            </span>
          </div>
          {program.producer && (
            <span style={{ color: 'var(--cream-text-muted)' }} className="text-xs truncate max-w-[100px]">
              {program.producer}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

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

export default function ProgramList({
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
      className={`cinema-card p-4 flex items-center gap-4 cursor-pointer ${selected ? 'selected' : ''}`}
      onClick={selectionMode ? onToggleSelect : undefined}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          selected ? 'bg-cinema-500 border-cinema-500' : 'border-white/50'
        }`}>
          {selected && (
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      )}
      
      {/* Thumbnail */}
      <div 
        className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ 
          background: `linear-gradient(135deg, ${program.genre.color}30, ${program.genre.color}10)`,
        }}
      >
        <span 
          className="text-2xl font-black"
          style={{ color: program.genre.color }}
        >
          {program.genre.nameFa.charAt(0)}
        </span>
      </div>
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span 
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ 
              backgroundColor: `${program.genre.color}20`,
              color: program.genre.color,
            }}
          >
            {program.genre.nameFa}
          </span>
          <span className="text-gray-600 text-xs">#{toFa(program.id)}</span>
          {program.hasImages && (
            <span className="bg-cinema-500/20 text-cinema-400 text-xs px-1.5 py-0.5 rounded">تصویر</span>
          )}
        </div>
        
        <h3 className="text-white font-bold text-sm mb-1 truncate">
          {program.title}
        </h3>
        
        {program.description && (
          <p className="text-gray-500 text-xs truncate">
            {program.description}
          </p>
        )}
      </div>
      
      {/* Stats */}
      <div className="flex items-center gap-6 flex-shrink-0">
        <div className="text-center">
          <div className="text-gray-500 text-xs">دقیقه</div>
          <div className="text-white font-bold text-sm">{toFa(program.duration)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">قسمت</div>
          <div className="text-white font-bold text-sm">{toFa(program.episodeCount)}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 text-xs">بیننده</div>
          <div className="text-white font-bold text-sm">{toFa(program.viewersCount)}</div>
        </div>
      </div>
      
      {/* Producer */}
      {program.producer && (
        <div className="text-gray-400 text-xs text-left flex-shrink-0 max-w-[120px] truncate">
          {program.producer}
        </div>
      )}
    </div>
  );
}

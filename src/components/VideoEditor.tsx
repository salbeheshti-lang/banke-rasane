'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

interface VideoEditorProps {
  onClose: () => void;
  onSave: (videoBlob: Blob, thumbnail: string, metadata: VideoMetadata) => void;
  showToast?: (msg: string) => void;
}

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  size: number;
  format: string;
}

export default function VideoEditor({ onClose, onSave, showToast }: VideoEditorProps) {
  const [ffmpeg, setFFmpeg] = useState<FFmpeg | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string>('');
  const [thumbnail, setThumbnail] = useState<string>('');
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [maxDuration, setMaxDuration] = useState(60); // 60s default
  const [targetSize, setTargetSize] = useState(5); // 5MB default
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputURL, setOutputURL] = useState<string>('');
  const [outputSize, setOutputSize] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load FFmpeg.wasm
  useEffect(() => {
    const loadFFmpeg = async () => {
      try {
        const ff = new FFmpeg();
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ff.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ff.on('progress', ({ progress }) => {
          setProgress(Math.round(progress * 100));
        });
        setFFmpeg(ff);
        setReady(true);
      } catch (e) {
        console.error('FFmpeg load error:', e);
        showToast?.('خطا در بارگذاری ویرایشگر ویدیو');
      }
    };
    loadFFmpeg();
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('video/')) {
      showToast?.('فقط فایل ویدیویی قابل قبول است');
      return;
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoURL(url);
    setOutputURL('');
    setOutputSize(0);

    // Get video metadata
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const meta: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        size: file.size,
        format: file.name.split('.').pop() || 'mp4',
      };
      setMetadata(meta);
      setTrimStart(0);
      setTrimEnd(Math.min(video.duration, maxDuration));

      // Generate thumbnail
      video.currentTime = Math.min(1, video.duration / 2);
      video.onseeked = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 320;
        canvas.height = Math.round(320 * (video.videoHeight / video.videoWidth));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
    };
    video.src = url;
  }, [maxDuration, showToast]);

  // Process video: trim + compress
  const handleProcess = async () => {
    if (!ffmpeg || !videoFile) return;
    setProcessing(true);
    setProgress(0);

    try {
      const inputName = 'input.' + (metadata?.format || 'mp4');
      const outputName = 'output.mp4';

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      // Calculate bitrate for target size
      // bitrate = (targetSize * 8) / duration  (in kbps)
      const trimDuration = trimEnd - trimStart;
      const targetBitrate = Math.floor((targetSize * 8 * 1024) / trimDuration);
      const clampedBitrate = Math.max(200, Math.min(targetBitrate, 2000));

      // FFmpeg command: trim + transcode to H.264 + AAC
      await ffmpeg.exec([
        '-i', inputName,
        '-ss', String(trimStart),
        '-to', String(trimEnd),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-b:v', `${clampedBitrate}k`,
        '-maxrate', `${clampedBitrate}k`,
        '-bufsize', `${clampedBitrate * 2}k`,
        '-vf', 'scale=-2:480',  // 480p height, auto width
        '-c:a', 'aac',
        '-b:a', '128k',
        '-y',
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);
      // Cast to Uint8Array<ArrayBuffer> — @ffmpeg/ffmpeg's FileData type uses
      // ArrayBufferLike which TypeScript 5.7+ rejects for Blob constructor.
      const bytes = data as Uint8Array<ArrayBuffer>;
      const blob = new Blob([bytes], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setOutputURL(url);
      setOutputSize(blob.size);

      // Update thumbnail from processed video
      const video = document.createElement('video');
      video.src = url;
      video.currentTime = 0.5;
      video.onseeked = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setThumbnail(canvas.toDataURL('image/jpeg', 0.8));
        }
      };

      showToast?.('ویدیو با موفقیت پردازش شد');
    } catch (e) {
      console.error('Process error:', e);
      showToast?.('خطا در پردازش ویدیو');
    } finally {
      setProcessing(false);
    }
  };

  const handleSave = () => {
    if (!outputURL) {
      showToast?.('ابتدا ویدیو را پردازش کنید');
      return;
    }
    fetch(outputURL)
      .then(r => r.blob())
      .then(blob => {
        onSave(blob, thumbnail, {
          duration: trimEnd - trimStart,
          width: metadata?.width || 0,
          height: 480,
          size: blob.size,
          format: 'mp4',
        });
        onClose();
      });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-modal-enter" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(85, 174, 183, 0.25)' }}>
          <h2 className="text-lg font-bold" style={{ color: '#F4FFFF' }}>🎬 ویرایشگر ویدیو</h2>
          <button onClick={onClose} className="p-2 rounded-lg" style={{ color: 'rgba(244,255,255,0.6)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!ready ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 border-3 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'rgba(0,229,239,0.2)', borderTopColor: '#00E5EF' }} />
            <p style={{ color: '#CDEFEF' }}>در حال بارگذاری ویرایشگر...</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* File input */}
            {!videoFile && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all"
                style={{ borderColor: 'rgba(85,174,183,0.3)', background: 'rgba(205,239,237,0.05)' }}
              >
                <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="rgba(0,229,239,0.5)" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p style={{ color: '#CDEFEF', fontWeight: 700 }}>فایل ویدیویی را انتخاب کنید</p>
                <p className="text-xs mt-1" style={{ color: 'rgba(244,255,255,0.4)' }}>MP4, AVI, MOV, MKV — حداکثر ۱۰۰ مگابایت</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
            )}

            {/* Video preview + metadata */}
            {videoFile && metadata && (
              <>
                <div className="rounded-xl overflow-hidden" style={{ background: '#000' }}>
                  <video
                    ref={videoRef}
                    src={videoURL}
                    className="w-full"
                    controls
                    style={{ maxHeight: '300px' }}
                  />
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(205,239,237,0.08)' }}>
                    <div className="text-xs" style={{ color: 'rgba(244,255,255,0.5)' }}>مدت</div>
                    <div className="text-sm font-bold" style={{ color: '#F4FFFF' }}>{formatTime(metadata.duration)}</div>
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(205,239,237,0.08)' }}>
                    <div className="text-xs" style={{ color: 'rgba(244,255,255,0.5)' }}>ابعاد</div>
                    <div className="text-sm font-bold" style={{ color: '#F4FFFF' }}>{metadata.width}×{metadata.height}</div>
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(205,239,237,0.08)' }}>
                    <div className="text-xs" style={{ color: 'rgba(244,255,255,0.5)' }}>حجم</div>
                    <div className="text-sm font-bold" style={{ color: '#F4FFFF' }}>{formatSize(metadata.size)}</div>
                  </div>
                  <div className="p-2 rounded-lg" style={{ background: 'rgba(205,239,237,0.08)' }}>
                    <div className="text-xs" style={{ color: 'rgba(244,255,255,0.5)' }}>فرمت</div>
                    <div className="text-sm font-bold" style={{ color: '#F4FFFF' }}>{metadata.format.toUpperCase()}</div>
                  </div>
                </div>

                {/* Trim controls */}
                <div className="space-y-2">
                  <label className="text-sm font-bold" style={{ color: '#CDEFEF' }}>✂️ برش ویدیو</label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs" style={{ color: 'rgba(244,255,255,0.5)' }}>شروع: {formatTime(trimStart)}</span>
                    <input
                      type="range"
                      min={0}
                      max={metadata.duration}
                      step={0.1}
                      value={trimStart}
                      onChange={(e) => setTrimStart(Math.min(parseFloat(e.target.value), trimEnd - 1))}
                      className="flex-1"
                      style={{ accentColor: '#00E5EF' }}
                    />
                    <span className="text-xs" style={{ color: 'rgba(244,255,255,0.5)' }}>پایان: {formatTime(trimEnd)}</span>
                  </div>
                  <input
                    type="range"
                    min={trimStart + 1}
                    max={metadata.duration}
                    step={0.1}
                    value={trimEnd}
                    onChange={(e) => setTrimEnd(Math.min(parseFloat(e.target.value), trimStart + maxDuration))}
                    className="w-full"
                    style={{ accentColor: '#00E5EF' }}
                  />
                  <div className="text-xs" style={{ color: 'rgba(244,255,255,0.4)' }}>
                    مدت نهایی: {formatTime(trimEnd - trimStart)} (حداکثر {formatTime(maxDuration)})
                  </div>
                </div>

                {/* Quality / size target */}
                <div className="space-y-2">
                  <label className="text-sm font-bold" style={{ color: '#CDEFEF' }}>📦 حجم هدف</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={targetSize}
                      onChange={(e) => setTargetSize(parseInt(e.target.value))}
                      className="flex-1"
                      style={{ accentColor: '#00E5EF' }}
                    />
                    <span className="text-sm font-bold" style={{ color: '#F4FFFF' }}>{targetSize} MB</span>
                  </div>
                  <div className="text-xs" style={{ color: 'rgba(244,255,255,0.4)' }}>
                    رزولوشن: 480p | کدک: H.264 + AAC
                  </div>
                </div>

                {/* Process button */}
                <button
                  onClick={handleProcess}
                  disabled={processing}
                  className="btn-enter-premium w-full"
                  style={{ padding: '12px' }}
                >
                  {processing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                      در حال پردازش... {progress}%
                    </span>
                  ) : (
                    '⚡ پردازش ویدیو'
                  )}
                </button>

                {/* Output preview */}
                {outputURL && (
                  <div className="space-y-2">
                    <div className="rounded-xl overflow-hidden" style={{ background: '#000' }}>
                      <video src={outputURL} className="w-full" controls style={{ maxHeight: '250px' }} />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg" style={{ background: 'rgba(0,229,239,0.10)' }}>
                      <span className="text-sm" style={{ color: '#CDEFEF' }}>
                        حجم نهایی: {formatSize(outputSize)}
                      </span>
                      <span className="text-xs" style={{ color: 'rgba(0,229,239,0.7)' }}>
                        {outputSize < metadata.size ? `▼ ${(Math.round((1 - outputSize / metadata.size) * 100))}٪ فشرده‌تر` : ''}
                      </span>
                    </div>
                    <button
                      onClick={handleSave}
                      className="btn-enter-premium w-full"
                      style={{ padding: '12px' }}
                    >
                      ✓ ذخیره ویدیو
                    </button>
                  </div>
                )}

                {/* New file button */}
                <button
                  onClick={() => {
                    setVideoFile(null);
                    setVideoURL('');
                    setOutputURL('');
                    setMetadata(null);
                    setThumbnail('');
                  }}
                  className="w-full text-sm py-2 rounded-lg"
                  style={{ color: 'rgba(244,255,255,0.5)', background: 'rgba(205,239,237,0.06)' }}
                >
                  انتخاب فایل جدید
                </button>
              </>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        )}
      </div>
    </div>
  );
}

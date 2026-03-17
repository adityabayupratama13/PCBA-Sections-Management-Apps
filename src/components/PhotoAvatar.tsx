'use client';

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, CheckCircle } from 'lucide-react';

interface PhotoAvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  canUpload?: boolean;
  onUploaded?: (url: string) => void;
  className?: string;
}

const SIZES = {
  sm:  { container: 'w-9 h-9',   text: 'text-sm',   icon: 'w-3 h-3',   ring: 'ring-2'  },
  md:  { container: 'w-16 h-16', text: 'text-xl',   icon: 'w-4 h-4',   ring: 'ring-2'  },
  lg:  { container: 'w-24 h-24', text: 'text-3xl',  icon: 'w-5 h-5',   ring: 'ring-[3px]' },
  xl:  { container: 'w-32 h-32', text: 'text-4xl',  icon: 'w-6 h-6',   ring: 'ring-[3px]' },
};

function getGradientByName(name: string): string {
  const gradients = [
    'from-violet-500 to-purple-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-amber-500',
    'from-pink-500 to-rose-500',
    'from-indigo-500 to-blue-600',
    'from-cyan-500 to-sky-600',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

// Anime.js particle burst on upload success
function triggerParticles(el: HTMLElement) {
  if (typeof window === 'undefined') return;
  import('animejs').then(({ default: anime }) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    for (let i = 0; i < 14; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `position:fixed;pointer-events:none;z-index:9999;width:8px;height:8px;border-radius:50%;background:${['#7c3aed','#06b6d4','#10b981','#f59e0b','#ec4899'][i % 5]};left:${cx}px;top:${cy}px;`;
      document.body.appendChild(particle);
      const angle = (i / 14) * Math.PI * 2;
      const dist = 50 + Math.random() * 40;
      anime({
        targets: particle,
        translateX: Math.cos(angle) * dist,
        translateY: Math.sin(angle) * dist,
        opacity: [1, 0],
        scale: [1, 0],
        duration: 700,
        easing: 'easeOutCubic',
        complete: () => particle.remove(),
      });
    }
  });
}

export default function PhotoAvatar({
  name,
  photoUrl,
  size = 'md',
  canUpload = false,
  onUploaded,
  className = '',
}: PhotoAvatarProps) {
  const s = SIZES[size];
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const displayUrl = previewUrl || photoUrl;
  const gradient = getGradientByName(name);
  const initial = name.charAt(0).toUpperCase();

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
      return;
    }
    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    setStatus('idle');

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const { url } = await res.json();
      setStatus('success');
      if (containerRef.current) triggerParticles(containerRef.current);
      setTimeout(() => setStatus('idle'), 2500);
      onUploaded?.(url);
    } catch {
      setPreviewUrl(null);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!canUpload) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [canUpload, handleFile]);

  return (
    <motion.div
      ref={containerRef}
      className={`relative flex-shrink-0 ${s.container} ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDragOver={e => { e.preventDefault(); if (canUpload) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      whileHover={canUpload ? { scale: 1.05 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
    >
      {/* Animated gradient ring */}
      {canUpload && (
        <motion.div
          className={`absolute inset-0 rounded-full ${s.ring} ring-offset-2`}
          style={{
            background: 'conic-gradient(from 0deg, #7c3aed, #06b6d4, #10b981, #f59e0b, #7c3aed)',
            ringOffsetColor: 'var(--background)',
          }}
          animate={hovered || dragging ? {
            rotate: [0, 360],
            opacity: [0.6, 1],
          } : { rotate: 0, opacity: 0 }}
          transition={{ rotate: { duration: 2, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.3 } }}
        />
      )}

      {/* Status ring: success / error */}
      <AnimatePresence>
        {status === 'success' && (
          <motion.div
            className={`absolute inset-0 rounded-full ring-2 ring-emerald-400 ring-offset-1`}
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          />
        )}
        {status === 'error' && (
          <motion.div
            className={`absolute inset-0 rounded-full ring-2 ring-red-400 ring-offset-1`}
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Avatar face */}
      <motion.div
        className={`w-full h-full rounded-full overflow-hidden relative z-10 shadow-lg`}
        animate={dragging ? { scale: 1.08 } : { scale: 1 }}
      >
        {displayUrl ? (
          <img src={displayUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className={`font-bold text-white ${s.text} select-none`}>{initial}</span>
          </div>
        )}

        {/* Upload overlay */}
        <AnimatePresence>
          {canUpload && (hovered || dragging || uploading) && (
            <motion.div
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1 cursor-pointer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !uploading && inputRef.current?.click()}
            >
              {uploading ? (
                <motion.div
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
                />
              ) : status === 'success' ? (
                <CheckCircle className={`${s.icon} text-emerald-400`} />
              ) : dragging ? (
                <Upload className={`${s.icon} text-cyan-300`} />
              ) : (
                <Camera className={`${s.icon} text-white`} />
              )}
              {size !== 'sm' && !uploading && (
                <span className="text-[10px] text-white/80 font-medium leading-none">
                  {dragging ? 'Drop' : status === 'success' ? '✓ Done' : 'Upload'}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Uploading pulse ring */}
      {uploading && (
        <motion.div
          className={`absolute inset-0 rounded-full border-2 border-cyan-400/60`}
          animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Hidden file input */}
      {canUpload && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
      )}

      {/* Error X badge */}
      <AnimatePresence>
        {status === 'error' && size !== 'sm' && (
          <motion.div
            className="absolute -top-1 -right-1 z-20 bg-red-500 rounded-full p-0.5 shadow"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
          >
            <X className="w-2.5 h-2.5 text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
